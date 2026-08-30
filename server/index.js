import { createServer } from 'node:http'
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/node'
import { getDeliveryFee, getDeliveryRegion } from '../shared/delivery.js'
import { managedProfilePayload, normalizeAccentColor, PROFILE_ACCENTS, PROFILE_BACKGROUNDS, PROFILE_TEMPLATES } from '../shared/managed-profile.js'
import { canTransitionOrder, canTransitionPayment, lifecycleTimestamps, ORDER_STATUSES, PAYMENT_STATUSES } from '../shared/order-lifecycle.js'
import { paidSalesByRegion } from '../shared/sales-metrics.js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY
if (!supabaseUrl || !supabaseSecretKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env and add your Supabase server credentials.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, { auth:{ autoRefreshToken:false, persistSession:false, detectSessionInUrl:false } })
const adminPassword = process.env.ADMIN_PASSWORD || ''
const adminTokenSecret = process.env.ADMIN_TOKEN_SECRET
if (!adminTokenSecret) {
  console.error('Missing ADMIN_TOKEN_SECRET. Add a long random secret to .env (it must differ from SUPABASE_SECRET_KEY).')
  process.exit(1)
}
const resendApiKey = process.env.RESEND_API_KEY || ''
const emailFrom = process.env.EMAIL_FROM || 'Tappy <orders@example.com>'
const resendWebhookSecret = process.env.RESEND_WEBHOOK_SECRET || ''
const cronSecret = process.env.CRON_SECRET || ''
const paymentReminderDelay = Math.max(Number.parseInt(process.env.PAYMENT_REMINDER_AFTER_MINUTES, 10) || 45, 15)
const unitPrice = 199
const allowedPayments = new Set(['gcash'])

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn:process.env.SENTRY_DSN,
    environment:process.env.SENTRY_ENVIRONMENT || (process.env.VERCEL ? 'production' : 'development'),
    sendDefaultPii:false,
    tracesSampleRate:process.env.VERCEL ? 0.05 : 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data
        delete event.request.cookies
        if (event.request.headers) {
          delete event.request.headers.authorization
          delete event.request.headers.cookie
        }
        event.request.url = event.request.url?.replace(/\/api\/pages\/edit\/[A-Za-z0-9_-]+/g, '/api/pages/edit/[redacted]')
      }
      if (event.transaction) event.transaction = event.transaction.replace(/\/api\/pages\/edit\/[A-Za-z0-9_-]+/g, '/api/pages/edit/[redacted]')
      event.breadcrumbs?.forEach((breadcrumb) => {
        if (breadcrumb.data?.url) breadcrumb.data.url = breadcrumb.data.url.replace(/\/api\/pages\/edit\/[A-Za-z0-9_-]+/g, '/api/pages/edit/[redacted]')
      })
      return event
    },
  })
}

// Simple in-memory rate limiter. On Vercel each warm instance keeps its own
// counters, which still blunts bursts; pair with Vercel WAF or Upstash Redis
// for strict global limits.
const rateBuckets = new Map()
function clientIp(request) {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim()
  return request.socket?.remoteAddress || 'unknown'
}
function rateLimit(key, limit, windowMs) {
  const now = Date.now()
  let bucket = rateBuckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    if (rateBuckets.size > 5000) for (const [entryKey, entry] of rateBuckets) if (now >= entry.resetAt) rateBuckets.delete(entryKey)
    bucket = { count:0, resetAt:now + windowMs }
    rateBuckets.set(key, bucket)
  }
  bucket.count += 1
  return bucket.count <= limit
}

function send(response, status, payload) {
  response.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' })
  response.end(JSON.stringify(payload))
}

async function readJson(request, maxBytes = 32_000) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) throw new Error('Payload too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function clean(value, limit) { return typeof value === 'string' ? value.trim().slice(0, limit) : '' }
function safeHttpsUrl(value, limit = 500) {
  const candidate = clean(value, limit)
  if (!candidate) return null
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'https:' ? parsed.toString() : null
  } catch { return null }
}
function cleanPageLinks(value) {
  if (!Array.isArray(value)) return []
  const allowedTypes = new Set(['website', 'instagram', 'linkedin', 'facebook', 'portfolio', 'booking', 'reviews', 'maps'])
  return value.slice(0, 8).map((link) => ({
    type:allowedTypes.has(link?.type) ? link.type : 'website',
    label:clean(link?.label, 40),
    url:safeHttpsUrl(link?.url),
  })).filter((link) => link.label && link.url)
}
async function readRaw(request, maxBytes = 128_000) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) throw new Error('Payload too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}
function verifyResendWebhook(rawBody, headers) {
  if (!resendWebhookSecret) return false
  const timestamp = headers['svix-timestamp']
  const messageId = headers['svix-id']
  const signatures = headers['svix-signature']
  if (!timestamp || !messageId || !signatures) return false
  const timestampNumber = Number(timestamp)
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false
  const secret = resendWebhookSecret.replace(/^whsec_/, '')
  let key
  try { key = Buffer.from(secret, 'base64') } catch { return false }
  const expected = createHmac('sha256', key).update(`${messageId}.${timestamp}.${rawBody}`).digest('base64')
  return signatures.split(' ').some((signature) => {
    const value = signature.replace(/^v\d+,/, '')
    return safeEqual(value, expected)
  })
}
function customerPageFields(body) {
  const allowed = new Set(['displayName','headline','bio','email','phone','location','accent','accentColor','backgroundTexture','template','links'])
  return pageFields(Object.fromEntries(Object.entries(body || {}).filter(([key]) => allowed.has(key))), true)
}
function hashEditToken(token) { return createHash('sha256').update(token).digest('hex') }
function profileImagePath(photoUrl) {
  if (!photoUrl) return null
  try {
    const marker = '/storage/v1/object/public/profile-images/'
    const pathname = new URL(photoUrl).pathname
    return pathname.includes(marker) ? decodeURIComponent(pathname.split(marker)[1]) : null
  } catch { return null }
}
function profileImageData(value) {
  const match = typeof value === 'string' && value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) throw new Error('Choose a valid JPG, PNG, or WebP image.')
  const image = Buffer.from(match[2], 'base64')
  if (!image.length || image.length > 3_145_728) throw new Error('Profile image must be smaller than 3 MB.')
  const isJpeg = image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
  const isPng = image.length >= 8 && image.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
  const isWebp = image.length >= 12 && image.subarray(0, 4).toString('ascii') === 'RIFF' && image.subarray(8, 12).toString('ascii') === 'WEBP'
  if ((match[1] === 'image/jpeg' && !isJpeg) || (match[1] === 'image/png' && !isPng) || (match[1] === 'image/webp' && !isWebp)) throw new Error('The selected file is not a valid image.')
  return { image, contentType:match[1], extension:match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1] }
}
async function uploadProfileImage(pageId, imageData) {
  const { image, contentType, extension } = profileImageData(imageData)
  const path = `${pageId}/${randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('profile-images').upload(path, image, { contentType, upsert:false, cacheControl:'31536000' })
  if (error) throw new Error('Profile image storage is not configured. Run migration 013.')
  const { data } = supabase.storage.from('profile-images').getPublicUrl(path)
  return { path, photoUrl:data.publicUrl }
}
async function removeProfileImage(photoUrl) {
  const path = profileImagePath(photoUrl)
  if (path) await supabase.storage.from('profile-images').remove([path])
}
function pageFields(body, partial = false) {
  const update = {}
  const assign = (key, value) => { if (!partial || body[key] !== undefined) update[key] = value }
  assign('displayName', clean(body.displayName, 100))
  assign('headline', clean(body.headline, 120) || null)
  assign('bio', clean(body.bio, 360) || null)
  assign('photoUrl', safeHttpsUrl(body.photoUrl))
  assign('email', clean(body.email, 160).toLowerCase() || null)
  assign('phone', clean(body.phone, 32) || null)
  assign('location', clean(body.location, 140) || null)
  assign('accent', PROFILE_ACCENTS.includes(body.accent) ? body.accent : 'forest')
  assign('accentColor', normalizeAccentColor(body.accentColor, body.accent))
  assign('backgroundTexture', PROFILE_BACKGROUNDS.includes(body.backgroundTexture) ? body.backgroundTexture : 'clean')
  assign('template', PROFILE_TEMPLATES.includes(body.template) ? body.template : 'classic')
  assign('links', cleanPageLinks(body.links))
  assign('internalNotes', clean(body.internalNotes, 1000) || null)
  assign('orderId', /^[0-9a-f-]{36}$/i.test(body.orderId || '') ? body.orderId : null)
  assign('status', ['draft','published','disabled'].includes(body.status) ? body.status : 'draft')
  return Object.fromEntries(Object.entries(update).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value]))
}
function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}
function emailTemplate({ preheader, badge, title, greeting, message, rows, notice }) {
  const rowHtml = rows.map(([label, value, strong = false]) => `<tr><td style="padding:13px 0;border-bottom:1px solid #e5e3dc;color:#666660;font-size:13px">${escapeHtml(label)}</td><td align="right" style="padding:13px 0;border-bottom:1px solid #e5e3dc;color:#151515;font-size:${strong ? '18px' : '13px'};font-weight:${strong ? '700' : '600'}">${value}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media(max-width:600px){.email-wrap{padding:24px 12px!important}.email-card{padding:26px 20px!important}.email-title{font-size:30px!important}.email-logo{font-size:25px!important}}</style></head><body style="margin:0;background:#f3f2ee;color:#151515;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f2ee"><tr><td class="email-wrap" align="center" style="padding:44px 20px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px"><tr><td class="email-logo" style="padding:0 4px 24px;font-size:28px;font-weight:800;letter-spacing:-1.8px">tappy.</td></tr><tr><td class="email-card" style="padding:38px 38px 34px;border:1px solid #d8d6cf;border-radius:18px;background:#fff"><p style="margin:0 0 16px;color:#244a3a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${escapeHtml(badge)}</p><h1 class="email-title" style="margin:0 0 18px;font-size:38px;line-height:1.04;letter-spacing:-1.8px">${escapeHtml(title)}</h1><p style="margin:0 0 12px;font-size:15px;line-height:1.65">Hi ${escapeHtml(greeting)},</p><p style="margin:0;color:#53534f;font-size:15px;line-height:1.65">${escapeHtml(message)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;border-top:1px solid #e5e3dc">${rowHtml}</table><div style="margin-top:26px;padding:16px 18px;border-left:3px solid #244a3a;background:#eef3f0;color:#34483f;font-size:13px;line-height:1.55">${escapeHtml(notice)}</div></td></tr><tr><td style="padding:22px 4px 0;color:#777770;font-size:12px;line-height:1.6">Questions? Reply to this email or contact <a href="mailto:hello@tappycard.tech" style="color:#244a3a;text-decoration:none">hello@tappycard.tech</a>.<br>Tappy · Made in the Philippines </td></tr></table></td></tr></table></body></html>`
}

async function deliverEmail({ to, subject, html, text, idempotencyKey, replyTo = 'hello@tappycard.tech' }) {
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{ authorization:`Bearer ${resendApiKey}`, 'content-type':'application/json', 'idempotency-key':idempotencyKey },
    body:JSON.stringify({ from:emailFrom, to:[to], reply_to:replyTo, subject, html, text }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || 'Resend rejected the email.')
  return { status:'sent', id:result.id || null }
}

async function sendOrderConfirmation(order) {
  if (!resendApiKey) return { status:'not_configured', id:null }
  const address = `${order.address}, ${order.city}, ${order.province} ${order.postal}`
  return deliverEmail({
    to:order.email,
    subject:`Order received - payment required - ${order.orderNumber}`,
    idempotencyKey:`order-v3-${order.orderNumber}`,
    text:`Hi ${order.name}, we received and reserved your Tappy order ${order.orderNumber}. Total: PHP ${order.total}. Complete your GCash payment and submit the receipt. Please wait for our payment verification email. Once payment is approved, we will prepare your order for delivery. Delivery address: ${address}`,
    html:emailTemplate({
      preheader:`Your Tappy order ${order.orderNumber} is reserved and awaiting GCash payment.`,
      badge:`Payment required · ${order.orderNumber}`,
      title:'Order received.',
      greeting:order.name,
      message:'We received and reserved your order. Complete the GCash QR payment and submit your receipt, then wait for our payment verification email. Once approved, we will prepare your order for delivery.',
      rows:[
        [`White Tappy card × ${order.quantity}`, `&#8369;${order.quantity * unitPrice}`],
        [`Delivery (${escapeHtml(order.deliveryRegion)})`, `&#8369;${order.shippingFee}`],
        ['Total', `&#8369;${order.total}`, true],
        ['Deliver to', escapeHtml(address)],
      ],
      notice:'Your order will only proceed to delivery preparation after your payment has been verified and approved.',
    }),
  })
}

async function sendPaymentDecisionEmail(order, decision) {
  if (!resendApiKey) return { status:'not_configured', id:null }
  const approved = decision === 'paid'
  return deliverEmail({
    to:order.email,
    subject:`${approved ? 'Payment confirmed' : 'Payment needs attention'} - ${order.order_number}`,
    idempotencyKey:`payment-v2-${order.id}-${decision}`,
    text:approved
      ? `Hi ${order.customer_name}, we verified your GCash payment for ${order.order_number}. Your order is ready for fulfillment.`
      : `Hi ${order.customer_name}, we could not verify the GCash payment proof for ${order.order_number}. Reply to this email so we can help.`,
    html:emailTemplate({
      preheader:approved ? 'Your GCash payment has been confirmed.' : 'We need your help verifying your GCash payment.',
      badge:`${approved ? 'Payment confirmed' : 'Action required'} · ${order.order_number}`,
      title:approved ? 'Payment confirmed.' : 'Payment needs attention.',
      greeting:order.customer_name,
      message:approved
        ? 'We verified your GCash payment. Your Tappy order is now queued for fulfillment.'
        : 'We could not match the submitted proof with the GCash transaction. Reply to this email with your order number so we can resolve it.',
      rows:[
        ['Order number', escapeHtml(order.order_number)],
        ['Order total', `&#8369;${order.total}`, true],
        ['Payment', approved ? 'Verified' : 'Not verified'],
      ],
      notice:approved ? 'We will contact you again when your order moves to delivery.' : 'Do not submit a second payment unless Tappy support instructs you to do so.',
    }),
  })
}

async function sendDeliveryEmail(order) {
  if (!resendApiKey) return { status:'not_configured', id:null }
  return deliverEmail({
    to:order.email,
    subject:`Order delivered - ${order.order_number}`,
    idempotencyKey:`delivery-v1-${order.id}`,
    text:`Hi ${order.customer_name}, your Tappy order ${order.order_number} has been marked as delivered. If you have not received it, reply to this email so we can help.`,
    html:emailTemplate({
      preheader:`Your Tappy order ${order.order_number} has been delivered.`,
      badge:`Delivered · ${order.order_number}`,
      title:'Your Tappy has arrived.',
      greeting:order.customer_name,
      message:'Your order has been marked as delivered. We hope your Tappy card makes every connection simpler.',
      rows:[
        ['Order number', escapeHtml(order.order_number)],
        ['Order total', `&#8369;${order.total}`, true],
        ['Status', 'Delivered'],
      ],
      notice:'If you have not received your order, reply to this email and include your order number so we can investigate.',
    }),
  })
}

function customerMessageHtml({ name, subject, body, orderNumber }) {
  const paragraphs = escapeHtml(body).split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#474b47">${paragraph.replaceAll('\n', '<br>')}</p>`).join('')
  return `<!doctype html><html><body style="margin:0;background:#f3f2ee;color:#151515;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f2ee"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px"><tr><td style="padding:0 4px 22px;font-size:28px;font-weight:800;letter-spacing:-1.8px">tappy.</td></tr><tr><td style="padding:34px;border:1px solid #d8d6cf;border-radius:18px;background:#fff"><p style="margin:0 0 12px;color:#244a3a;font-size:13px;font-weight:700">Order ${escapeHtml(orderNumber)}</p><h1 style="margin:0 0 22px;font-size:30px;line-height:1.1;letter-spacing:-1px">${escapeHtml(subject)}</h1><p style="margin:0 0 16px;font-size:15px;line-height:1.65">Hi ${escapeHtml(name)},</p>${paragraphs}<p style="margin:26px 0 0;font-size:14px;line-height:1.6;color:#626660">Tappy customer support<br><a href="mailto:hello@tappycard.tech" style="color:#244a3a;text-decoration:none">hello@tappycard.tech</a></p></td></tr></table></td></tr></table></body></html>`
}

async function sendPaymentReminderEmail(order) {
  if (!resendApiKey) return { status:'not_configured', id:null }
  return deliverEmail({
    to:order.email,
    subject:`Reminder: complete your Tappy payment - ${order.order_number}`,
    idempotencyKey:`payment-reminder-v1-${order.id}`,
    text:`Hi ${order.customer_name}, your Tappy order ${order.order_number} is still reserved and awaiting GCash payment proof. Total: PHP ${order.total}. If you already paid, reply to this email with your receipt and order number. If you no longer want the order, you can ignore this reminder or contact hello@tappycard.tech to cancel it.`,
    html:emailTemplate({
      preheader:`Your Tappy order ${order.order_number} is still awaiting GCash payment proof.`,
      badge:`Payment reminder · ${order.order_number}`,
      title:'Your order is still reserved.',
      greeting:order.customer_name,
      message:'We have not received your GCash payment proof yet. Complete the payment shown on your order page, then submit the receipt for verification. If you already paid but closed the page, reply to this email with your receipt and order number.',
      rows:[
        ['Order number', escapeHtml(order.order_number)],
        ['Amount due', `&#8369;${order.total}`, true],
        ['Status', 'Awaiting payment proof'],
      ],
      notice:'This is the only automatic reminder we will send for this order. Ignore it if you no longer wish to continue, or contact us to cancel the order.',
    }),
  })
}

async function sendPageAccessEmail({ email, name, editUrl, expiresAt }) {
  if (!resendApiKey) return { status:'not_configured', id:null }
  const safeUrl = escapeHtml(editUrl)
  const expiry = new Intl.DateTimeFormat('en-PH', { dateStyle:'long' }).format(new Date(expiresAt))
  return deliverEmail({
    to:email,
    subject:'Your Tappy Page editing link',
    idempotencyKey:`page-access-${hashEditToken(editUrl).slice(0, 24)}`,
    text:`Hi ${name}, you can update your Tappy Page at ${editUrl}. This private link expires on ${expiry}. Do not share it.`,
    html:`<!doctype html><html><body style="margin:0;background:#f3f2ee;color:#151515;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:44px 20px"><table role="presentation" width="100%" style="max-width:600px"><tr><td style="padding:0 4px 24px;font-size:28px;font-weight:800">tappy.</td></tr><tr><td style="padding:38px;border:1px solid #d8d6cf;border-radius:18px;background:#fff"><p style="margin:0 0 14px;color:#244a3a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Private page access</p><h1 style="margin:0 0 18px;font-size:36px;line-height:1.05">Your page, in your hands.</h1><p style="color:#53534f;line-height:1.65">Hi ${escapeHtml(name)}, use the private button below to update your public Tappy Page. Anyone with this link can edit your page, so do not share it.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:15px 22px;border-radius:10px;background:#244a3a;color:#fff;text-decoration:none;font-weight:700">Edit my Tappy Page</a></p><p style="margin:0;color:#777770;font-size:12px;line-height:1.6">This link expires on ${escapeHtml(expiry)}. Contact hello@tappycard.tech if you need a new link.</p></td></tr></table></td></tr></table></body></html>`,
  })
}

async function sendFeedbackLinkEmail({ email, name, feedbackUrl, expiresAt }) {
  if (!resendApiKey) return { status:'not_configured', id:null }
  const safeUrl = escapeHtml(feedbackUrl)
  const expiry = new Intl.DateTimeFormat('en-PH', { dateStyle:'long' }).format(new Date(expiresAt))
  return deliverEmail({
    to:email,
    subject:'Share your Tappy feedback',
    idempotencyKey:`feedback-${hashEditToken(feedbackUrl).slice(0, 24)}`,
    text:`Hi ${name}, thank you for your Tappy order. Share your feedback about our product and service at ${feedbackUrl}. This private link expires on ${expiry} and can only be used once. Do not share it.`,
    html:`<!doctype html><html><body style="margin:0;background:#f3f2ee;color:#151515;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:44px 20px"><table role="presentation" width="100%" style="max-width:600px"><tr><td style="padding:0 4px 24px;font-size:28px;font-weight:800">tappy.</td></tr><tr><td style="padding:38px;border:1px solid #d8d6cf;border-radius:18px;background:#fff"><p style="margin:0 0 14px;color:#244a3a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Customer feedback</p><h1 style="margin:0 0 18px;font-size:36px;line-height:1.05">How did we do?</h1><p style="color:#53534f;line-height:1.65">Hi ${escapeHtml(name)}, thank you for choosing Tappy. Use the private button below to rate our product and service — it takes about a minute. Your feedback helps us improve.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:15px 22px;border-radius:10px;background:#244a3a;color:#fff;text-decoration:none;font-weight:700">Leave my feedback</a></p><p style="margin:0;color:#777770;font-size:12px;line-height:1.6">This link expires on ${escapeHtml(expiry)} and can only be used once. Contact hello@tappycard.tech if you need a new link.</p></td></tr></table></td></tr></table></body></html>`,
  })
}

function safeEqual(left, right) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
function signAdminToken() {
  const payload = Buffer.from(JSON.stringify({ role:'admin', exp:Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url')
  const signature = createHmac('sha256', adminTokenSecret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}
function signOrderToken(orderNumber) {
  const payload = Buffer.from(JSON.stringify({ orderNumber, exp:Date.now() + 2 * 60 * 60 * 1000 })).toString('base64url')
  const signature = createHmac('sha256', adminTokenSecret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}
function isOrderToken(request, orderNumber) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') || ''
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  const expected = createHmac('sha256', adminTokenSecret).update(payload).digest('base64url')
  if (!safeEqual(signature, expected)) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return data.orderNumber === orderNumber && Number(data.exp) > Date.now()
  } catch { return false }
}
function isAdmin(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') || ''
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  const expected = createHmac('sha256', adminTokenSecret).update(payload).digest('base64url')
  if (!safeEqual(signature, expected)) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return data.role === 'admin' && Number(data.exp) > Date.now()
  } catch { return false }
}
function createOrderNumber() {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `TAP-${day}-${randomUUID().slice(0, 6).toUpperCase()}`
}

async function requestHandler(request, response) {
  const url = new URL(request.url, 'http://127.0.0.1')
  if (request.method === 'GET' && request.url === '/api/health') {
    const { error } = await supabase.from('orders').select('id', { head:true, count:'exact' }).limit(1)
    return send(response, error ? 503 : 200, error ? { ok:false, error:'Supabase unavailable or schema not installed.' } : { ok:true, backend:'supabase' })
  }

  if (request.method === 'GET' && url.pathname === '/api/cron/payment-reminders') {
    if (!cronSecret) return send(response, 503, { error:'Payment reminders are not configured.' })
    const authorization = request.headers.authorization || ''
    if (!safeEqual(authorization, `Bearer ${cronSecret}`)) return send(response, 401, { error:'Unauthorized.' })
    if (!resendApiKey) return send(response, 503, { error:'Email delivery is not configured.' })
    const cutoff = new Date(Date.now() - paymentReminderDelay * 60 * 1000).toISOString()
    const { data:orders, error } = await supabase.from('orders')
      .select('id,order_number,customer_name,email,total')
      .eq('payment_status', 'awaiting_payment')
      .eq('order_status', 'pending_payment_verification')
      .is('payment_reminder_email_sent_at', null)
      .lte('created_at', cutoff)
      .order('created_at', { ascending:true })
      .limit(100)
    if (error) return send(response, 503, { error:'Payment reminders could not be loaded. Run migration 018.' })
    const results = { checked:orders.length, sent:0, failed:0 }
    for (const order of orders) {
      let delivery
      try { delivery = await sendPaymentReminderEmail(order) }
      catch (emailError) {
        delivery = { status:'failed', id:null }
        console.error('Payment reminder failed:', emailError.message)
      }
      const sentAt = delivery.status === 'sent' ? new Date().toISOString() : null
      const { error:updateError } = await supabase.from('orders').update({
        payment_reminder_email_status:delivery.status,
        payment_reminder_email_id:delivery.id,
        payment_reminder_email_sent_at:sentAt,
        payment_reminder_last_attempt_at:new Date().toISOString(),
      }).eq('id', order.id).is('payment_reminder_email_sent_at', null)
      if (updateError) console.error('Payment reminder tracking failed:', updateError.message)
      if (delivery.status === 'sent') results.sent += 1
      else results.failed += 1
    }
    return send(response, 200, results)
  }

  if (request.method === 'POST' && url.pathname === '/api/analytics') {
    try {
      const body = await readJson(request, 4_000)
      const allowedEvents = new Set(['homepage_view', 'order_click', 'checkout_start', 'profile_view'])
      const eventName = clean(body.eventName, 40)
      const eventId = clean(body.eventId, 36)
      if (!allowedEvents.has(eventName) || !/^[0-9a-f-]{36}$/i.test(eventId)) return send(response, 400, { error:'Invalid analytics event.' })
      const pageId = eventName === 'profile_view' && /^[A-Za-z0-9_-]{22}$/.test(body.pageId || '') ? body.pageId : null
      const { error } = await supabase.from('analytics_events').insert({ event_id:eventId, event_name:eventName, session_id:clean(body.sessionId, 64) || null, page_id:pageId, path:clean(body.path, 180) || null })
      if (error?.code === '23505') return send(response, 202, { accepted:true })
      if (error) return send(response, 503, { error:'Analytics is not configured. Run migration 009.' })
      return send(response, 202, { accepted:true })
    } catch { return send(response, 400, { error:'Invalid analytics event.' }) }
  }

  if (request.method === 'POST' && url.pathname === '/api/webhooks/resend') {
    let rawBody
    try { rawBody = await readRaw(request) } catch { return send(response, 413, { error:'Webhook payload too large.' }) }
    if (!verifyResendWebhook(rawBody, request.headers)) return send(response, resendWebhookSecret ? 401 : 503, { error: resendWebhookSecret ? 'Invalid webhook signature.' : 'Webhook signing secret is not configured.' })
    let event
    try { event = JSON.parse(rawBody) } catch { return send(response, 400, { error:'Invalid webhook payload.' }) }
    if (event.type !== 'email.received' || !event.data?.email_id) return send(response, 200, { received:true })
    try {
      const metadata = event.data
      const receivedResponse = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(metadata.email_id)}`, { headers:{ authorization:`Bearer ${resendApiKey}` } })
      if (!receivedResponse.ok) throw new Error('Received email could not be retrieved.')
      const received = await receivedResponse.json()
      const sender = clean(metadata.from || received.from, 160).toLowerCase()
      const subject = clean(metadata.subject || received.subject, 180) || 'Customer reply'
      const bodyText = clean(received.text || received.html?.replace(/<[^>]+>/g, ' '), 10000)
      if (!sender || !bodyText) return send(response, 200, { received:true, stored:false })
      const { data:order, error:orderError } = await supabase.from('orders').select('id,order_number,customer_name,email').ilike('email', sender).order('created_at', { ascending:false }).limit(1).maybeSingle()
      if (orderError || !order) return send(response, 200, { received:true, stored:false })
      const { data:thread, error:threadError } = await supabase.from('email_threads').upsert({ order_id:order.id, customer_name:order.customer_name, customer_email:order.email, subject, last_message_at:new Date().toISOString(), unread_count:1 }, { onConflict:'order_id', ignoreDuplicates:false }).select('*').single()
      if (threadError) throw threadError
      const { data:duplicate } = await supabase.from('email_messages').select('id').eq('thread_id', thread.id).eq('provider_message_id', metadata.message_id || metadata.email_id).maybeSingle()
      if (duplicate) return send(response, 200, { received:true, stored:false, duplicate:true })
      const { error:messageError } = await supabase.from('email_messages').insert({ thread_id:thread.id, direction:'inbound', sender_email:sender, recipient_email:clean((metadata.to || [emailFrom])[0], 160), subject, body_text:bodyText, provider_message_id:metadata.message_id || metadata.email_id, provider_email_id:metadata.email_id, delivery_status:'received' })
      if (messageError) throw messageError
      return send(response, 200, { received:true, stored:true, orderNumber:order.order_number })
    } catch (error) {
      Sentry.captureException(error, { tags:{ operation:'resend_inbound_webhook' } })
      return send(response, 500, { error:'Inbound email could not be processed.' })
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/login') {
    if (!adminPassword) return send(response, 503, { error:'Admin access is not configured. Add ADMIN_PASSWORD to .env.' })
    if (!rateLimit(`login:${clientIp(request)}`, 5, 15 * 60 * 1000)) return send(response, 429, { error:'Too many sign-in attempts. Try again in 15 minutes.' })
    try {
      const body = await readJson(request)
      if (!safeEqual(clean(body.password, 200), adminPassword)) return send(response, 401, { error:'Incorrect password.' })
      return send(response, 200, { token:signAdminToken(), expiresIn:28_800 })
    } catch { return send(response, 400, { error:'Invalid request.' }) }
  }

  if (url.pathname.startsWith('/api/admin/')) {
    if (!isAdmin(request)) return send(response, 401, { error:'Admin session required.' })
    if (request.method === 'GET' && url.pathname === '/api/admin/messages') {
      const { data:threads, error:threadError } = await supabase.from('email_threads').select('*,orders(order_number,order_status,payment_status)').order('last_message_at', { ascending:false }).limit(100)
      if (threadError) return send(response, 503, { error:'Messages are not configured. Run migration 019.' })
      const threadIds = threads.map((thread) => thread.id)
      let messages = []
      if (threadIds.length) {
        const { data, error } = await supabase.from('email_messages').select('*').in('thread_id', threadIds).order('created_at', { ascending:true })
        if (error) return send(response, 503, { error:'Message history could not be loaded.' })
        messages = data
      }
      const byThread = new Map()
      for (const message of messages) byThread.set(message.thread_id, [...(byThread.get(message.thread_id) || []), message])
      return send(response, 200, { threads:threads.map((thread) => ({ ...thread, messages:byThread.get(thread.id) || [] })) })
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/messages') {
      if (!resendApiKey) return send(response, 503, { error:'Email delivery is not configured.' })
      try {
        const body = await readJson(request, 24_000)
        const orderId = clean(body.orderId, 36)
        const subject = clean(body.subject, 180)
        const bodyText = clean(body.body, 10_000)
        if (!/^[0-9a-f-]{36}$/i.test(orderId) || !subject || !bodyText) return send(response, 400, { error:'Choose an order and add a subject and message.' })
        const { data:order, error:orderError } = await supabase.from('orders').select('id,order_number,customer_name,email').eq('id', orderId).single()
        if (orderError || !order?.email) return send(response, 404, { error:'The customer order could not be found.' })
        const { data:thread, error:threadError } = await supabase.from('email_threads').upsert({ order_id:order.id, customer_name:order.customer_name, customer_email:order.email, subject, last_message_at:new Date().toISOString() }, { onConflict:'order_id' }).select('*').single()
        if (threadError) return send(response, 503, { error:'Messages are not configured. Run migration 019.' })
        const messageId = randomUUID()
        const { data:message, error:messageError } = await supabase.from('email_messages').insert({ id:messageId, thread_id:thread.id, direction:'outbound', sender_email:emailFrom, recipient_email:order.email, subject, body_text:bodyText, delivery_status:'queued' }).select('*').single()
        if (messageError) return send(response, 503, { error:'The message could not be saved.' })
        try {
          const delivery = await deliverEmail({ to:order.email, subject, text:`Hi ${order.customer_name},\n\n${bodyText}\n\nTappy customer support`, html:customerMessageHtml({ name:order.customer_name, subject, body:bodyText, orderNumber:order.order_number }), idempotencyKey:`admin-message-${messageId}` })
          const { data:sentMessage } = await supabase.from('email_messages').update({ delivery_status:'sent', provider_email_id:delivery.id }).eq('id', messageId).select('*').single()
          return send(response, 201, { thread:{ ...thread, orders:{ order_number:order.order_number }, messages:[sentMessage || { ...message, delivery_status:'sent', provider_email_id:delivery.id }] } })
        } catch (emailError) {
          await supabase.from('email_messages').update({ delivery_status:'failed' }).eq('id', messageId)
          return send(response, 502, { error:`Email could not be sent: ${emailError.message}` })
        }
      } catch { return send(response, 400, { error:'Invalid message request.' }) }
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/feedback') {
      const { data, error } = await supabase.from('feedback')
        .select('*,orders(order_number,customer_name,email)')
        .order('created_at', { ascending:false }).limit(200)
      if (error) return send(response, 503, { error:'Feedback is not configured. Run migration 020.' })
      return send(response, 200, { feedback:data })
    }
    const feedbackMatch = url.pathname.match(/^\/api\/admin\/feedback\/([0-9a-f-]{36})$/i)
    if (request.method === 'PATCH' && feedbackMatch) {
      try {
        const body = await readJson(request, 4_000)
        if (!['published', 'hidden', 'pending'].includes(body.status)) return send(response, 400, { error:'Invalid feedback status.' })
        const update = { status:body.status }
        if (body.status === 'published') update.published_at = new Date().toISOString()
        const { data, error } = await supabase.from('feedback').update(update).eq('id', feedbackMatch[1]).select('id,status,published_at').single()
        if (error) return send(response, 503, { error:'Feedback status could not be updated.' })
        return send(response, 200, { feedback:data })
      } catch { return send(response, 400, { error:'Invalid feedback update.' }) }
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/pages') {
      const { data, error } = await supabase.from('tappy_pages').select('*,orders(order_number,customer_name,email,payment_status)').order('created_at', { ascending:false }).limit(200)
      if (error) return send(response, 503, { error:'Tappy Pages could not be loaded. Run migration 007 if it is not installed.' })
      return send(response, 200, { pages:data })
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/pages') {
      try {
        const body = await readJson(request)
        const fields = pageFields(body)
        if (!fields.display_name) return send(response, 400, { error:'Add a page name.' })
        const publicId = randomBytes(16).toString('base64url')
        const { data, error } = await supabase.from('tappy_pages').insert({
          ...fields,
          public_id:publicId,
          published_at:fields.status === 'published' ? new Date().toISOString() : null,
        }).select('*,orders(order_number,customer_name,email,payment_status)').single()
        if (error?.code === '23505') return send(response, 409, { error:'That order already has a Tappy Page.' })
        if (error) return send(response, 503, { error:'Tappy Page could not be created.' })
        return send(response, 201, { page:data })
      } catch { return send(response, 400, { error:'Invalid page details.' }) }
    }
    const pagePhotoMatch = url.pathname.match(/^\/api\/admin\/pages\/([0-9a-f-]{36})\/photo$/i)
    if (pagePhotoMatch && ['POST','DELETE'].includes(request.method)) {
      const { data:page, error:pageError } = await supabase.from('tappy_pages').select('id,photo_url').eq('id', pagePhotoMatch[1]).maybeSingle()
      if (pageError || !page) return send(response, 404, { error:'Tappy Page not found.' })
      if (request.method === 'DELETE') {
        const { error:updateError } = await supabase.from('tappy_pages').update({ photo_url:null }).eq('id', page.id)
        if (updateError) return send(response, 503, { error:'Profile photo could not be removed.' })
        await removeProfileImage(page.photo_url)
        return send(response, 200, { photoUrl:null })
      }
      let uploaded
      try {
        const body = await readJson(request, 4_400_000)
        uploaded = await uploadProfileImage(page.id, body.imageData)
        const { error:updateError } = await supabase.from('tappy_pages').update({ photo_url:uploaded.photoUrl }).eq('id', page.id)
        if (updateError) {
          await supabase.storage.from('profile-images').remove([uploaded.path])
          return send(response, 503, { error:'Profile photo could not be saved.' })
        }
        await removeProfileImage(page.photo_url)
        return send(response, 200, { photoUrl:uploaded.photoUrl })
      } catch (error) {
        return send(response, error.message?.includes('3 MB') ? 413 : 400, { error:error.message || 'Invalid profile image.' })
      }
    }
    const pageMatch = url.pathname.match(/^\/api\/admin\/pages\/([0-9a-f-]{36})$/i)
    if (request.method === 'PATCH' && pageMatch) {
      try {
        const body = await readJson(request)
        const fields = pageFields(body, true)
        if (fields.display_name !== undefined && !fields.display_name) return send(response, 400, { error:'Add a page name.' })
        if (fields.status === 'published') fields.published_at = new Date().toISOString()
        if (!Object.keys(fields).length) return send(response, 400, { error:'No valid changes supplied.' })
        const { data, error } = await supabase.from('tappy_pages').update(fields).eq('id', pageMatch[1]).select('*,orders(order_number,customer_name,email,payment_status)').single()
        if (error?.code === '23505') return send(response, 409, { error:'That order already has a Tappy Page.' })
        if (error) return send(response, 503, { error:'Tappy Page could not be updated.' })
        return send(response, 200, { page:data })
      } catch { return send(response, 400, { error:'Invalid page details.' }) }
    }
    const pageAccessMatch = url.pathname.match(/^\/api\/admin\/pages\/([0-9a-f-]{36})\/customer-access$/i)
    if (request.method === 'POST' && pageAccessMatch) {
      const { data:page, error:pageError } = await supabase.from('tappy_pages')
        .select('id,display_name,order_id,orders(customer_name,email,payment_status)')
        .eq('id', pageAccessMatch[1]).single()
      if (pageError || !page) return send(response, 404, { error:'Tappy Page not found.' })
      const order = Array.isArray(page.orders) ? page.orders[0] : page.orders
      if (!page.order_id || order?.payment_status !== 'paid') return send(response, 409, { error:'Link this page to a paid order before granting customer access.' })
      if (!order?.email) return send(response, 409, { error:'The linked order has no customer email.' })
      const rawToken = randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      const { error:revokeError } = await supabase.from('page_edit_tokens').update({ revoked_at:new Date().toISOString() }).eq('page_id', page.id).is('revoked_at', null)
      if (revokeError) return send(response, 503, { error:'Customer editing is not configured. Run migration 012.' })
      const { error:tokenError } = await supabase.from('page_edit_tokens').insert({ page_id:page.id, token_hash:hashEditToken(rawToken), expires_at:expiresAt })
      if (tokenError) return send(response, 503, { error:'Customer editing is not configured. Run migration 012.' })
      const origin = clean(process.env.PUBLIC_SITE_URL, 300).replace(/\/$/, '') || 'https://www.tappycard.tech'
      const editUrl = `${origin}/edit/${rawToken}`
      let email = { status:'not_configured', id:null }
      try { email = await sendPageAccessEmail({ email:order.email, name:order.customer_name || page.display_name, editUrl, expiresAt }) }
      catch (emailError) {
        Sentry.captureException(emailError, { tags:{ operation:'page_access_email' } })
        email = { status:'failed', id:null }
      }
      return send(response, 201, { editUrl, expiresAt, emailStatus:email.status })
    }
    const orderFeedbackLinkMatch = url.pathname.match(/^\/api\/admin\/orders\/([0-9a-f-]{36})\/feedback-link$/i)
    if (request.method === 'POST' && orderFeedbackLinkMatch) {
      const { data:order, error:orderError } = await supabase.from('orders')
        .select('id,order_number,customer_name,email,payment_status,order_status')
        .eq('id', orderFeedbackLinkMatch[1]).single()
      if (orderError || !order) return send(response, 404, { error:'Order not found.' })
      if (order.payment_status !== 'paid') return send(response, 409, { error:'Feedback links can only be sent for paid orders.' })
      if (!order.email) return send(response, 409, { error:'The order has no customer email.' })
      const { data:existingFeedback } = await supabase.from('feedback').select('id').eq('order_id', order.id).maybeSingle()
      if (existingFeedback) return send(response, 409, { error:'This order already has feedback.' })
      const rawToken = randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { error:tokenError } = await supabase.from('feedback_tokens').insert({ email:order.email, order_id:order.id, token_hash:hashEditToken(rawToken), expires_at:expiresAt })
      if (tokenError) return send(response, 503, { error:'Feedback is not configured. Run migration 020.' })
      const origin = clean(process.env.PUBLIC_SITE_URL, 300).replace(/\/$/, '') || 'https://www.tappycard.tech'
      let email = { status:'not_configured', id:null }
      try { email = await sendFeedbackLinkEmail({ email:order.email, name:order.customer_name, feedbackUrl:`${origin}/feedback?t=${rawToken}`, expiresAt }) }
      catch (emailError) {
        Sentry.captureException(emailError, { tags:{ operation:'admin_feedback_link_email' } })
        email = { status:'failed', id:null }
      }
      return send(response, 201, { emailStatus:email.status })
    }
    if (request.method === 'DELETE' && pageAccessMatch) {
      const { error } = await supabase.from('page_edit_tokens').update({ revoked_at:new Date().toISOString() }).eq('page_id', pageAccessMatch[1]).is('revoked_at', null)
      if (error) return send(response, 503, { error:'Customer access could not be revoked. Run migration 012.' })
      return send(response, 200, { revoked:true })
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/sales-metrics') {
      const paidOrders = []
      const pageSize = 1000
      let page = 0
      while (true) {
        const from = page * pageSize
        const { data, error } = await supabase.from('orders').select('total,quantity,created_at,delivery_region').eq('payment_status', 'paid').order('created_at', { ascending:true }).range(from, from + pageSize - 1)
        if (error) return send(response, 503, { error:'Sales metrics could not be loaded.' })
        paidOrders.push(...data)
        if (data.length < pageSize) break
        page += 1
      }
      const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
      const cards = paidOrders.reduce((sum, order) => sum + Number(order.quantity || 0), 0)
      const now = new Date()
      const daily = Array.from({ length:14 }, (_, index) => {
        const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13 + index))
        return { key:day.toISOString().slice(0, 10), revenue:0, orders:0 }
      })
      const monthly = Array.from({ length:6 }, (_, index) => {
        const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1))
        return { key:month.toISOString().slice(0, 7), revenue:0, orders:0 }
      })
      const dailyMap = new Map(daily.map((entry) => [entry.key, entry]))
      const monthlyMap = new Map(monthly.map((entry) => [entry.key, entry]))
      paidOrders.forEach((order) => {
        const dayKey = new Date(order.created_at).toISOString().slice(0, 10)
        const monthKey = dayKey.slice(0, 7)
        const amount = Number(order.total || 0)
        if (dailyMap.has(dayKey)) { dailyMap.get(dayKey).revenue += amount; dailyMap.get(dayKey).orders += 1 }
        if (monthlyMap.has(monthKey)) { monthlyMap.get(monthKey).revenue += amount; monthlyMap.get(monthKey).orders += 1 }
      })
      return send(response, 200, { metrics:{ revenue, paid:paidOrders.length, cards, average:paidOrders.length ? revenue / paidOrders.length : 0, daily, monthly, regions:paidSalesByRegion(paidOrders) } })
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/analytics') {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const events = []
      const pageSize = 1000
      let eventPage = 0
      while (true) {
        const from = eventPage * pageSize
        const { data, error } = await supabase.from('analytics_events').select('event_name,session_id,page_id,created_at').gte('created_at', since).order('created_at', { ascending:true }).range(from, from + pageSize - 1)
        if (error) return send(response, 503, { error:'Analytics could not be loaded. Run migration 009.' })
        events.push(...data)
        if (data.length < pageSize) break
        eventPage += 1
      }
      const count = (name) => events.filter((event) => event.event_name === name).length
      const unique = (name) => new Set(events.filter((event) => event.event_name === name).map((event) => event.session_id).filter(Boolean)).size
      const profileCounts = new Map()
      events.filter((event) => event.event_name === 'profile_view' && event.page_id).forEach((event) => profileCounts.set(event.page_id, (profileCounts.get(event.page_id) || 0) + 1))
      return send(response, 200, { analytics:{ periodDays:30, homepageVisits:count('homepage_view'), homepageVisitors:unique('homepage_view'), orderClicks:count('order_click'), checkoutStarts:count('checkout_start'), completedOrders:count('order_completed'), profileVisits:count('profile_view'), profileVisitors:unique('profile_view'), topProfiles:[...profileCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([pageId, views]) => ({ pageId, views })) } })
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/orders') {
      const status = clean(url.searchParams.get('status'), 40)
      const search = clean(url.searchParams.get('q'), 60).replace(/[,()%]/g, ' ').trim()
      const paidOnly = url.searchParams.get('paid') === '1'
      const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit'), 10) || 25, 1), 100)
      const page = Math.max(Number.parseInt(url.searchParams.get('page'), 10) || 1, 1)
      const from = (page - 1) * limit
      let query = supabase.from('orders').select('*', { count:'exact' }).order('created_at', { ascending:false }).range(from, from + limit - 1)
      if (paidOnly) query = query.eq('payment_status', 'paid')
      else if (status === 'payment_review') query = query.eq('payment_status', 'proof_submitted')
      else if (status === 'in_progress') query = query.in('order_status', ['processing', 'shipped'])
      else if (status === 'to_fulfill') query = query.eq('order_status', 'pending_fulfillment')
      else if (status === 'completed') query = query.eq('order_status', 'delivered')
      else if (status === 'cancelled') query = query.eq('order_status', 'cancelled')
      if (search) query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,email.ilike.%${search}%`)
      const { data, error, count } = await query
      if (error) return send(response, 503, { error:'Orders could not be loaded.' })
      const total = count ?? 0
      return send(response, 200, { orders:data, total, page, limit, totalPages:Math.max(1, Math.ceil(total / limit)) })
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/order-counts') {
      const [all, unread, payment, fulfillment, inProgress, completed, cancelled] = await Promise.all([
        supabase.from('orders').select('id', { head:true, count:'exact' }),
        supabase.from('orders').select('id', { head:true, count:'exact' }).is('admin_read_at', null),
        supabase.from('orders').select('id', { head:true, count:'exact' }).eq('payment_status', 'proof_submitted'),
        supabase.from('orders').select('id', { head:true, count:'exact' }).eq('order_status', 'pending_fulfillment'),
        supabase.from('orders').select('id', { head:true, count:'exact' }).in('order_status', ['processing', 'shipped']),
        supabase.from('orders').select('id', { head:true, count:'exact' }).eq('order_status', 'delivered'),
        supabase.from('orders').select('id', { head:true, count:'exact' }).eq('order_status', 'cancelled'),
      ])
      if ([all, unread, payment, fulfillment, inProgress, completed, cancelled].some((result) => result.error)) return send(response, 503, { error:'Order counts could not be loaded.' })
      return send(response, 200, { counts:{ all:all.count ?? 0, unread:unread.count ?? 0, payment:payment.count ?? 0, fulfillment:fulfillment.count ?? 0, inProgress:inProgress.count ?? 0, completed:completed.count ?? 0, cancelled:cancelled.count ?? 0 } })
    }
    const proofMatch = url.pathname.match(/^\/api\/admin\/orders\/([0-9a-f-]{36})\/payment-proof$/i)
    if (request.method === 'GET' && proofMatch) {
      const { data:order, error:orderError } = await supabase.from('orders').select('payment_proof_path').eq('id', proofMatch[1]).single()
      if (orderError || !order?.payment_proof_path) return send(response, 404, { error:'No payment proof is available.' })
      const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(order.payment_proof_path, 300)
      if (error) return send(response, 503, { error:'Payment proof could not be opened.' })
      return send(response, 200, { url:data.signedUrl })
    }
    const match = url.pathname.match(/^\/api\/admin\/orders\/([0-9a-f-]{36})$/i)
    if (request.method === 'PATCH' && match) {
      try {
        const body = await readJson(request)
        const allowedOrderStatuses = new Set(ORDER_STATUSES)
        const allowedPaymentStatuses = new Set(PAYMENT_STATUSES)
        const update = {}
        if (body.orderStatus !== undefined && allowedOrderStatuses.has(body.orderStatus)) update.order_status = body.orderStatus
        if (body.paymentStatus !== undefined && allowedPaymentStatuses.has(body.paymentStatus)) update.payment_status = body.paymentStatus
        if (body.paymentReference !== undefined) update.payment_reference = clean(body.paymentReference, 100) || null
        if (body.adminNotes !== undefined) update.admin_notes = clean(body.adminNotes, 1000) || null
        if (body.markRead === true || ['paid','rejected'].includes(update.payment_status) || update.order_status === 'delivered') update.admin_read_at = new Date().toISOString()
        if (!Object.keys(update).length) return send(response, 400, { error:'No valid changes supplied.' })
        const { data:before, error:beforeError } = await supabase.from('orders').select('*').eq('id', match[1]).single()
        if (beforeError) return send(response, 404, { error:'Order not found.' })
        const nextPaymentStatus = update.payment_status || before.payment_status
        const nextOrderStatus = update.order_status || before.order_status
        if (update.payment_status && !canTransitionPayment(before.payment_status, nextPaymentStatus)) {
          return send(response, 409, { error:`Payment cannot move from ${before.payment_status.replaceAll('_', ' ')} to ${nextPaymentStatus.replaceAll('_', ' ')}.` })
        }
        if (update.order_status && !canTransitionOrder(before.order_status, nextOrderStatus, nextPaymentStatus)) {
          return send(response, 409, { error:`Order cannot move from ${before.order_status.replaceAll('_', ' ')} to ${nextOrderStatus.replaceAll('_', ' ')}.` })
        }
        Object.assign(update, lifecycleTimestamps(before.order_status, nextOrderStatus))
        const { data, error } = await supabase.from('orders').update(update).eq('id', match[1]).select('*').single()
        if (error) return send(response, 503, { error:'Order could not be updated.' })
        const decision = ['paid','rejected'].includes(update.payment_status) && before.payment_status !== update.payment_status ? update.payment_status : null
        const delivered = update.order_status === 'delivered' && before.order_status !== 'delivered'
        if (delivered) {
          let deliveryEmail = { status:'not_configured', id:null }
          try { deliveryEmail = await sendDeliveryEmail(data) }
          catch (emailError) {
            deliveryEmail = { status:'failed', id:null }
            console.error('Delivery email failed:', emailError.message)
          }
          const deliveryUpdate = {
            delivery_email_status:deliveryEmail.status,
            delivery_email_id:deliveryEmail.id,
            delivery_email_sent_at:deliveryEmail.status === 'sent' ? new Date().toISOString() : null,
          }
          const { data:tracked, error:trackingError } = await supabase.from('orders').update(deliveryUpdate).eq('id', data.id).select('*').single()
          if (trackingError) console.error('Delivery email tracking failed. Run migration 006:', trackingError.message)
          return send(response, 200, { order:tracked || { ...data, ...deliveryUpdate }, emailStatus:deliveryEmail.status, emailType:'delivered' })
        }
        if (!decision) return send(response, 200, { order:data })
        let delivery = { status:'not_configured', id:null }
        try { delivery = await sendPaymentDecisionEmail(data, decision) }
        catch (emailError) {
          delivery = { status:'failed', id:null }
          console.error('Payment decision email failed:', emailError.message)
        }
        const emailUpdate = {
          payment_decision_email_status:delivery.status,
          payment_decision_email_id:delivery.id,
          payment_decision_email_type:decision,
          payment_decision_email_sent_at:delivery.status === 'sent' ? new Date().toISOString() : null,
        }
        const { data:tracked, error:trackingError } = await supabase.from('orders').update(emailUpdate).eq('id', data.id).select('*').single()
        if (trackingError) console.error('Payment email tracking failed. Run migration 004:', trackingError.message)
        return send(response, 200, { order:tracked || { ...data, ...emailUpdate }, emailStatus:delivery.status })
      } catch { return send(response, 400, { error:'Invalid request.' }) }
    }
    return send(response, 404, { error:'Not found' })
  }

  const publicPageMatch = url.pathname.match(/^\/api\/pages\/([A-Za-z0-9_-]{22})$/)
  if (request.method === 'GET' && publicPageMatch) {
    const { data, error } = await supabase.from('tappy_pages')
      .select('*')
      .eq('public_id', publicPageMatch[1]).eq('status', 'published').maybeSingle()
    if (error || !data) return send(response, 404, { error:'Page not found.' })
    return send(response, 200, { page:managedProfilePayload(data) })
  }

  const customerPhotoMatch = url.pathname.match(/^\/api\/pages\/edit\/([A-Za-z0-9_-]{43})\/photo$/)
  if (customerPhotoMatch && ['POST','DELETE'].includes(request.method)) {
    if (!rateLimit(`page-photo:${clientIp(request)}`, 30, 60 * 60 * 1000)) return send(response, 429, { error:'Too many photo requests. Try again later.' })
    const tokenHash = hashEditToken(customerPhotoMatch[1])
    const { data:access, error:accessError } = await supabase.from('page_edit_tokens').select('id,page_id,expires_at,revoked_at').eq('token_hash', tokenHash).maybeSingle()
    if (accessError) return send(response, 503, { error:'Customer editing is not configured. Run migration 012.' })
    if (!access || access.revoked_at || new Date(access.expires_at).getTime() <= Date.now()) return send(response, 401, { error:'This editing link is invalid or expired.' })
    const { data:page, error:pageError } = await supabase.from('tappy_pages').select('*').eq('id', access.page_id).single()
    if (pageError || !page || page.status === 'disabled') return send(response, 404, { error:'This Tappy Page is unavailable.' })
    const snapshot = { display_name:page.display_name, headline:page.headline, bio:page.bio, photo_url:page.photo_url, email:page.email, phone:page.phone, location:page.location, accent:page.accent, accent_color:page.accent_color, background_texture:page.background_texture, template:page.template, links:page.links }
    const { error:revisionError } = await supabase.from('tappy_page_revisions').insert({ page_id:page.id, changed_by:'customer', snapshot })
    if (revisionError) return send(response, 503, { error:'Page history could not be saved. Run migration 012.' })
    if (request.method === 'DELETE') {
      const { error:updateError } = await supabase.from('tappy_pages').update({ photo_url:null }).eq('id', page.id)
      if (updateError) return send(response, 503, { error:'Your photo could not be removed.' })
      await removeProfileImage(page.photo_url)
      await supabase.from('page_edit_tokens').update({ last_used_at:new Date().toISOString() }).eq('id', access.id)
      return send(response, 200, { photoUrl:null })
    }
    try {
      const body = await readJson(request, 4_400_000)
      const uploaded = await uploadProfileImage(page.id, body.imageData)
      const { error:updateError } = await supabase.from('tappy_pages').update({ photo_url:uploaded.photoUrl }).eq('id', page.id)
      if (updateError) {
        await supabase.storage.from('profile-images').remove([uploaded.path])
        return send(response, 503, { error:'Your photo could not be saved.' })
      }
      await removeProfileImage(page.photo_url)
      await supabase.from('page_edit_tokens').update({ last_used_at:new Date().toISOString() }).eq('id', access.id)
      return send(response, 200, { photoUrl:uploaded.photoUrl })
    } catch (error) {
      Sentry.captureException(error, { tags:{ operation:'customer_photo_upload' } })
      return send(response, error.message?.includes('3 MB') ? 413 : 400, { error:error.message || 'Invalid profile image.' })
    }
  }

  const customerEditMatch = url.pathname.match(/^\/api\/pages\/edit\/([A-Za-z0-9_-]{43})$/)
  if (customerEditMatch && ['GET','PATCH'].includes(request.method)) {
    if (!rateLimit(`page-edit:${clientIp(request)}`, 120, 60 * 60 * 1000)) return send(response, 429, { error:'Too many page requests. Try again later.' })
    const tokenHash = hashEditToken(customerEditMatch[1])
    const { data:access, error:accessError } = await supabase.from('page_edit_tokens').select('id,page_id,expires_at,revoked_at').eq('token_hash', tokenHash).maybeSingle()
    if (accessError) return send(response, 503, { error:'Customer editing is not configured. Run migration 012.' })
    if (!access || access.revoked_at || new Date(access.expires_at).getTime() <= Date.now()) return send(response, 401, { error:'This editing link is invalid or expired.' })
    const { data:page, error:pageError } = await supabase.from('tappy_pages').select('*').eq('id', access.page_id).single()
    if (pageError || !page || page.status === 'disabled') return send(response, 404, { error:'This Tappy Page is unavailable.' })
    if (request.method === 'GET') {
      await supabase.from('page_edit_tokens').update({ last_used_at:new Date().toISOString() }).eq('id', access.id)
      return send(response, 200, { page:managedProfilePayload(page), expiresAt:access.expires_at })
    }
    try {
      const body = await readJson(request, 4_400_000)
      const fields = customerPageFields(body)
      let uploaded = null
      const removePhoto = body.removePhoto === true
      if (body.photoImageData) {
        uploaded = await uploadProfileImage(page.id, body.photoImageData)
        fields.photo_url = uploaded.photoUrl
      } else if (removePhoto) fields.photo_url = null
      if (fields.display_name !== undefined && !fields.display_name) return send(response, 400, { error:'Add a display name.' })
      if (!Object.keys(fields).length) return send(response, 400, { error:'No valid changes supplied.' })
      const snapshot = { display_name:page.display_name, headline:page.headline, bio:page.bio, photo_url:page.photo_url, email:page.email, phone:page.phone, location:page.location, accent:page.accent, accent_color:page.accent_color, background_texture:page.background_texture, template:page.template, links:page.links }
      const { error:revisionError } = await supabase.from('tappy_page_revisions').insert({ page_id:page.id, changed_by:'customer', snapshot })
      if (revisionError) {
        if (uploaded) await supabase.storage.from('profile-images').remove([uploaded.path])
        return send(response, 503, { error:'Page history could not be saved. Run migration 012.' })
      }
      const { data:updated, error:updateError } = await supabase.from('tappy_pages').update(fields).eq('id', page.id).select('*').single()
      if (updateError) {
        if (uploaded) await supabase.storage.from('profile-images').remove([uploaded.path])
        return send(response, 503, { error:'Your page could not be updated.' })
      }
      if ((uploaded || removePhoto) && page.photo_url && page.photo_url !== updated.photo_url) await removeProfileImage(page.photo_url)
      await supabase.from('page_edit_tokens').update({ last_used_at:new Date().toISOString() }).eq('id', access.id)
      return send(response, 200, { page:managedProfilePayload(updated) })
    } catch (error) {
      Sentry.captureException(error, { tags:{ operation:'customer_page_update' } })
      return send(response, 400, { error:'Invalid page details.' })
    }
  }

  const proofSubmission = url.pathname.match(/^\/api\/orders\/([A-Z0-9-]+)\/payment-proof$/)
  if (request.method === 'POST' && proofSubmission) {
    const orderNumber = proofSubmission[1]
    if (!isOrderToken(request, orderNumber)) return send(response, 401, { error:'This payment session expired. Contact Tappy with your order number.' })
    try {
      const body = await readJson(request, 4_400_000)
      const reference = clean(body.reference, 100).replace(/\s+/g, '')
      const senderName = clean(body.senderName, 100)
      const senderPhone = clean(body.senderPhone, 32)
      const receiptMatch = typeof body.receiptData === 'string' && body.receiptData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
      if (reference.length < 6 || !senderName || !senderPhone || !receiptMatch) return send(response, 400, { error:'Add the GCash reference, sender details, and a valid receipt image.' })
      const receipt = Buffer.from(receiptMatch[2], 'base64')
      if (!receipt.length || receipt.length > 3_145_728) return send(response, 413, { error:'Receipt image must be smaller than 3 MB.' })
      const { data:order, error:orderError } = await supabase.from('orders').select('id,payment_status,payment_proof_path').eq('order_number', orderNumber).single()
      if (orderError || !order) return send(response, 404, { error:'Order not found.' })
      if (order.payment_status === 'paid') return send(response, 409, { error:'This order is already marked as paid.' })
      const extension = receiptMatch[1] === 'image/jpeg' ? 'jpg' : receiptMatch[1].split('/')[1]
      const proofPath = `${order.id}/${randomUUID()}.${extension}`
      const { error:uploadError } = await supabase.storage.from('payment-proofs').upload(proofPath, receipt, { contentType:receiptMatch[1], upsert:false })
      if (uploadError) return send(response, 503, { error:'Receipt upload failed. Please try again.' })
      const { data, error } = await supabase.from('orders').update({
        payment_reference:reference,
        payment_sender_name:senderName,
        payment_sender_phone:senderPhone,
        payment_proof_path:proofPath,
        payment_proof_submitted_at:new Date().toISOString(),
        payment_status:'proof_submitted',
        order_status:'pending_payment_verification',
      }).eq('id', order.id).select('payment_status,payment_proof_submitted_at').single()
      if (error) {
        await supabase.storage.from('payment-proofs').remove([proofPath])
        if (error.code === '23505') return send(response, 409, { error:'That GCash reference number has already been submitted.' })
        return send(response, 503, { error:'Payment proof could not be saved.' })
      }
      if (order.payment_proof_path) await supabase.storage.from('payment-proofs').remove([order.payment_proof_path])
      return send(response, 200, { paymentStatus:data.payment_status, submittedAt:data.payment_proof_submitted_at })
    } catch (error) {
      return send(response, error.message === 'Payload too large' ? 413 : 400, { error:error.message === 'Payload too large' ? 'Receipt image must be smaller than 3 MB.' : 'Invalid payment proof.' })
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/feedback/request') {
    if (!rateLimit(`feedback-request:${clientIp(request)}`, 5, 60 * 60 * 1000)) return send(response, 429, { error:'Too many feedback requests. Try again later.' })
    try {
      const body = await readJson(request, 4_000)
      const email = clean(body.email, 160).toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(response, 400, { error:'Enter a valid email address.' })
      const { data:order, error:orderError } = await supabase.from('orders')
        .select('id,order_number,customer_name,email')
        .eq('email', email).eq('payment_status', 'paid').neq('order_status', 'cancelled')
        .order('created_at', { ascending:false }).limit(1).maybeSingle()
      if (orderError) return send(response, 503, { error:'Feedback is temporarily unavailable. Please try again.' })
      if (!order) return send(response, 200, { ok:true })
      if (!rateLimit(`feedback-request-email:${email}`, 3, 60 * 60 * 1000)) return send(response, 200, { ok:true })
      const { data:existing } = await supabase.from('feedback').select('id').eq('order_id', order.id).maybeSingle()
      if (existing) return send(response, 200, { ok:true, alreadySubmitted:true })
      const rawToken = randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { error:tokenError } = await supabase.from('feedback_tokens').insert({ email, order_id:order.id, token_hash:hashEditToken(rawToken), expires_at:expiresAt })
      if (tokenError) return send(response, 503, { error:'Feedback is not configured. Run migration 020.' })
      const origin = clean(process.env.PUBLIC_SITE_URL, 300).replace(/\/$/, '') || 'https://www.tappycard.tech'
      let emailDelivery = { status:'not_configured', id:null }
      try { emailDelivery = await sendFeedbackLinkEmail({ email, name:order.customer_name, feedbackUrl:`${origin}/feedback?t=${rawToken}`, expiresAt }) }
      catch (emailError) {
        Sentry.captureException(emailError, { tags:{ operation:'feedback_link_email' } })
        emailDelivery = { status:'failed', id:null }
      }
      return send(response, 200, { ok:true, emailStatus:emailDelivery.status })
    } catch { return send(response, 400, { error:'Invalid feedback request.' }) }
  }

  if (request.method === 'GET' && url.pathname === '/api/feedback/verify') {
    const rawToken = url.searchParams.get('t') || ''
    if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return send(response, 401, { error:'This feedback link is invalid or expired.' })
    const { data:access, error:accessError } = await supabase.from('feedback_tokens')
      .select('id,email,used_at,expires_at,orders(order_number,customer_name)')
      .eq('token_hash', hashEditToken(rawToken)).maybeSingle()
    if (accessError) return send(response, 503, { error:'Feedback is temporarily unavailable. Please try again.' })
    if (!access || access.used_at || new Date(access.expires_at).getTime() <= Date.now()) return send(response, 401, { error:'This feedback link is invalid, used, or expired.' })
    const order = Array.isArray(access.orders) ? access.orders[0] : access.orders
    return send(response, 200, { email:access.email, orderNumber:order?.order_number || '', customerName:order?.customer_name || '' })
  }

  if (request.method === 'POST' && url.pathname === '/api/feedback/submit') {
    if (!rateLimit(`feedback-submit:${clientIp(request)}`, 10, 60 * 60 * 1000)) return send(response, 429, { error:'Too many submissions. Try again later.' })
    try {
      const body = await readJson(request, 16_000)
      const rawToken = clean(body.token, 64)
      const toRating = (value) => (Number.isInteger(value) && value >= 1 && value <= 5 ? value : null)
      const rating = toRating(body.rating)
      const productRating = toRating(body.productRating)
      const serviceRating = toRating(body.serviceRating)
      const comment = clean(body.comment, 2000)
      const displayName = clean(body.displayName, 60) || 'Tappy customer'
      if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return send(response, 401, { error:'This feedback link is invalid or expired.' })
      if (!rating || !productRating || !serviceRating) return send(response, 400, { error:'Rate the product, the service, and your overall experience.' })
      const { data:access, error:accessError } = await supabase.from('feedback_tokens').select('id,email,order_id,used_at,expires_at').eq('token_hash', hashEditToken(rawToken)).maybeSingle()
      if (accessError) return send(response, 503, { error:'Feedback is temporarily unavailable. Please try again.' })
      if (!access || access.used_at || new Date(access.expires_at).getTime() <= Date.now()) return send(response, 401, { error:'This feedback link is invalid, used, or expired.' })
      const { error:insertError } = await supabase.from('feedback').insert({
        order_id:access.order_id, email:access.email, display_name:displayName,
        rating, product_rating:productRating, service_rating:serviceRating, comment:comment || null,
      })
      if (insertError) {
        if (insertError.code === '23505') return send(response, 409, { error:'Feedback has already been submitted for this order.' })
        return send(response, 503, { error:'Your feedback could not be saved. Please try again.' })
      }
      await supabase.from('feedback_tokens').update({ used_at:new Date().toISOString() }).eq('id', access.id)
      return send(response, 201, { ok:true })
    } catch { return send(response, 400, { error:'Invalid feedback submission.' }) }
  }

  if (request.method === 'GET' && url.pathname === '/api/feedback/public') {
    const { data, error } = await supabase.from('feedback')
      .select('display_name,rating,product_rating,service_rating,comment,created_at')
      .eq('status', 'published').order('created_at', { ascending:false }).limit(50)
    if (error) return send(response, 503, { error:'Feedback is not available. Run migration 020.' })
    const average = (key) => {
      const values = data.map((entry) => entry[key]).filter((value) => Number.isInteger(value))
      return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null
    }
    return send(response, 200, {
      feedback:data,
      averages:{ overall:average('rating'), product:average('product_rating'), service:average('service_rating'), count:data.length },
    })
  }

  if (request.method !== 'POST' || url.pathname !== '/api/orders') return send(response, 404, { error:'Not found' })
  if (!rateLimit(`orders:${clientIp(request)}`, 10, 60 * 60 * 1000)) return send(response, 429, { error:'Too many orders submitted from this connection. Please try again later.' })

  try {
    const body = await readJson(request)
    const order = {
      name:clean(body.name, 100), email:clean(body.email, 160).toLowerCase(), phone:clean(body.phone, 32),
      address:clean(body.address, 220), city:clean(body.city, 100), province:clean(body.province, 100), postal:clean(body.postal, 16),
      payment:clean(body.payment, 16), quantity:Number(body.quantity),
    }
    if (!order.name || !order.email.includes('@') || !order.phone || !order.address || !order.city || !order.province || !order.postal) return send(response, 400, { error:'Complete all customer and delivery fields.' })
    if (!Number.isInteger(order.quantity) || order.quantity < 1 || order.quantity > 10) return send(response, 400, { error:'Quantity must be between 1 and 10.' })
    if (!allowedPayments.has(order.payment)) return send(response, 400, { error:'Choose a valid payment method.' })

    const deliveryRegion = getDeliveryRegion(order.province)
    const shippingFee = getDeliveryFee(order.province)
    if (!deliveryRegion || shippingFee == null) return send(response, 400, { error:'Choose a supported Philippine province.' })
    order.deliveryRegion = deliveryRegion
    order.shippingFee = shippingFee
    const orderNumber = createOrderNumber()
    const total = order.quantity * unitPrice + shippingFee
    const paymentStatus = 'awaiting_payment'
    const orderStatus = 'pending_payment_verification'
    const { data, error } = await supabase.from('orders').insert({
      order_number:orderNumber, customer_name:order.name, email:order.email, phone:order.phone,
      address:order.address, city:order.city, province:order.province, delivery_region:deliveryRegion, postal_code:order.postal, quantity:order.quantity,
      unit_price:unitPrice, shipping_fee:shippingFee, total, payment_method:order.payment,
      payment_status:paymentStatus, order_status:orderStatus,
    }).select('id,order_number,total,payment_method,payment_status,order_status,created_at').single()
    if (error) {
      console.error('Supabase order insert failed:', error.message)
      return send(response, 503, { error:'The order could not be saved. Please try again.' })
    }
    const { error:analyticsError } = await supabase.from('analytics_events').insert({ event_id:randomUUID(), event_name:'order_completed', order_id:data.id, path:'/order' })
    if (analyticsError) console.error('Order analytics failed. Run migration 009:', analyticsError.message)
    let emailDelivery = { status:'not_configured', id:null }
    try {
      emailDelivery = await sendOrderConfirmation({ ...order, orderNumber:data.order_number, total:data.total })
    } catch (emailError) {
      emailDelivery = { status:'failed', id:null }
      console.error('Order confirmation email failed:', emailError.message)
    }
    const { error:emailTrackingError } = await supabase.from('orders').update({ confirmation_email_status:emailDelivery.status, confirmation_email_id:emailDelivery.id }).eq('order_number', data.order_number)
    if (emailTrackingError) console.error('Email status tracking failed. Run the email delivery migration:', emailTrackingError.message)
    return send(response, 201, { orderNumber:data.order_number, total:data.total, paymentMethod:data.payment_method, paymentStatus:data.payment_status, orderStatus:data.order_status, createdAt:data.created_at, emailStatus:emailDelivery.status, proofToken:signOrderToken(data.order_number) })
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 500
    if (status === 500) Sentry.captureException(error, { tags:{ operation:'create_order' } })
    return send(response, status, { error:status === 400 ? 'Invalid request.' : 'The order could not be saved. Please try again.' })
  }
}

export async function handler(request, response) {
  try {
    return await requestHandler(request, response)
  } catch (error) {
    Sentry.captureException(error, { tags:{ operation:'unhandled_api_request' } })
    await Sentry.flush(2000)
    if (!response.headersSent) return send(response, 500, { error:'The request could not be completed.' })
    response.end()
  }
}

const port = Number(process.env.PORT || 8787)
if (!process.env.VERCEL) {
  const server = createServer(handler)
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') console.error(`Port ${port} is already in use. Stop the existing API process and try again.`)
    else console.error(error)
    process.exit(1)
  })
  server.listen(port, '127.0.0.1', () => console.log(`Tappy Supabase API listening on http://127.0.0.1:${port}`))
}
