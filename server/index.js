import { createServer } from 'node:http'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY
if (!supabaseUrl || !supabaseSecretKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env and add your Supabase server credentials.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, { auth:{ autoRefreshToken:false, persistSession:false, detectSessionInUrl:false } })
const adminPassword = process.env.ADMIN_PASSWORD || ''
const adminTokenSecret = process.env.ADMIN_TOKEN_SECRET || supabaseSecretKey
const resendApiKey = process.env.RESEND_API_KEY || ''
const emailFrom = process.env.EMAIL_FROM || 'Tappy <orders@example.com>'
const unitPrice = 199
const shippingFee = 80
const allowedPayments = new Set(['gcash'])

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
function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}
function emailTemplate({ preheader, badge, title, greeting, message, rows, notice }) {
  const rowHtml = rows.map(([label, value, strong = false]) => `<tr><td style="padding:13px 0;border-bottom:1px solid #e5e3dc;color:#666660;font-size:13px">${escapeHtml(label)}</td><td align="right" style="padding:13px 0;border-bottom:1px solid #e5e3dc;color:#151515;font-size:${strong ? '18px' : '13px'};font-weight:${strong ? '700' : '600'}">${value}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media(max-width:600px){.email-wrap{padding:24px 12px!important}.email-card{padding:26px 20px!important}.email-title{font-size:30px!important}.email-logo{font-size:25px!important}}</style></head><body style="margin:0;background:#f3f2ee;color:#151515;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f2ee"><tr><td class="email-wrap" align="center" style="padding:44px 20px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px"><tr><td class="email-logo" style="padding:0 4px 24px;font-size:28px;font-weight:800;letter-spacing:-1.8px">tappy.</td></tr><tr><td class="email-card" style="padding:38px 38px 34px;border:1px solid #d8d6cf;border-radius:18px;background:#fff"><p style="margin:0 0 16px;color:#244a3a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${escapeHtml(badge)}</p><h1 class="email-title" style="margin:0 0 18px;font-size:38px;line-height:1.04;letter-spacing:-1.8px">${escapeHtml(title)}</h1><p style="margin:0 0 12px;font-size:15px;line-height:1.65">Hi ${escapeHtml(greeting)},</p><p style="margin:0;color:#53534f;font-size:15px;line-height:1.65">${escapeHtml(message)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;border-top:1px solid #e5e3dc">${rowHtml}</table><div style="margin-top:26px;padding:16px 18px;border-left:3px solid #244a3a;background:#eef3f0;color:#34483f;font-size:13px;line-height:1.55">${escapeHtml(notice)}</div></td></tr><tr><td style="padding:22px 4px 0;color:#777770;font-size:12px;line-height:1.6">Questions? Reply to this email or contact <a href="mailto:hello@tappy.ph" style="color:#244a3a;text-decoration:none">hello@tappy.ph</a>.<br>Tappy · Made in the Philippines</td></tr></table></td></tr></table></body></html>`
}

async function deliverEmail({ to, subject, html, text, idempotencyKey }) {
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{ authorization:`Bearer ${resendApiKey}`, 'content-type':'application/json', 'idempotency-key':idempotencyKey },
    body:JSON.stringify({ from:emailFrom, to:[to], subject, html, text }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || 'Resend rejected the email.')
  return { status:'sent', id:result.id || null }
}

async function sendOrderConfirmation(order) {
  if (!resendApiKey) return { status:'not_configured', id:null }
  const address = `${order.address}, ${order.city} ${order.postal}`
  return deliverEmail({
    to:order.email,
    subject:`Order received - ${order.orderNumber}`,
    idempotencyKey:`order-v2-${order.orderNumber}`,
    text:`Hi ${order.name}, your Tappy order ${order.orderNumber} has been reserved. Total: PHP ${order.total}. Complete your GCash payment and submit the receipt for verification. Delivery address: ${address}`,
    html:emailTemplate({
      preheader:`Your Tappy order ${order.orderNumber} is reserved and awaiting GCash payment.`,
      badge:`Payment required · ${order.orderNumber}`,
      title:'Order received.',
      greeting:order.name,
      message:'Your card is reserved. Complete the GCash QR payment and submit your receipt so we can verify it before fulfillment.',
      rows:[
        [`White Tappy card × ${order.quantity}`, `&#8369;${order.quantity * unitPrice}`],
        ['Delivery', `&#8369;${shippingFee}`],
        ['Total', `&#8369;${order.total}`, true],
        ['Deliver to', escapeHtml(address)],
      ],
      notice:'Payment is not confirmed until the GCash transaction and submitted receipt have been verified.',
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

export async function handler(request, response) {
  const url = new URL(request.url, 'http://127.0.0.1')
  if (request.method === 'GET' && request.url === '/api/health') {
    const { error } = await supabase.from('orders').select('id', { head:true, count:'exact' }).limit(1)
    return send(response, error ? 503 : 200, error ? { ok:false, error:'Supabase unavailable or schema not installed.' } : { ok:true, backend:'supabase' })
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/login') {
    if (!adminPassword) return send(response, 503, { error:'Admin access is not configured. Add ADMIN_PASSWORD to .env.' })
    try {
      const body = await readJson(request)
      if (!safeEqual(clean(body.password, 200), adminPassword)) return send(response, 401, { error:'Incorrect password.' })
      return send(response, 200, { token:signAdminToken(), expiresIn:28_800 })
    } catch { return send(response, 400, { error:'Invalid request.' }) }
  }

  if (url.pathname.startsWith('/api/admin/')) {
    if (!isAdmin(request)) return send(response, 401, { error:'Admin session required.' })
    if (request.method === 'GET' && url.pathname === '/api/admin/sales-metrics') {
      const paidOrders = []
      const pageSize = 1000
      let page = 0
      while (true) {
        const from = page * pageSize
        const { data, error } = await supabase.from('orders').select('total,quantity,created_at').eq('payment_status', 'paid').order('created_at', { ascending:true }).range(from, from + pageSize - 1)
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
      return send(response, 200, { metrics:{ revenue, paid:paidOrders.length, cards, average:paidOrders.length ? revenue / paidOrders.length : 0, daily, monthly } })
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/orders') {
      const status = clean(url.searchParams.get('status'), 40)
      let query = supabase.from('orders').select('*').order('created_at', { ascending:false }).limit(100)
      if (status && status !== 'all') query = query.eq('order_status', status)
      const { data, error } = await query
      if (error) return send(response, 503, { error:'Orders could not be loaded.' })
      return send(response, 200, { orders:data })
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
        const allowedOrderStatuses = new Set(['pending_payment_verification','pending_fulfillment','processing','shipped','delivered','cancelled'])
        const allowedPaymentStatuses = new Set(['awaiting_payment','proof_submitted','paid','rejected'])
        const update = {}
        if (body.orderStatus !== undefined && allowedOrderStatuses.has(body.orderStatus)) update.order_status = body.orderStatus
        if (body.paymentStatus !== undefined && allowedPaymentStatuses.has(body.paymentStatus)) update.payment_status = body.paymentStatus
        if (body.paymentReference !== undefined) update.payment_reference = clean(body.paymentReference, 100) || null
        if (body.adminNotes !== undefined) update.admin_notes = clean(body.adminNotes, 1000) || null
        if (body.markRead === true || ['paid','rejected'].includes(update.payment_status) || update.order_status === 'delivered') update.admin_read_at = new Date().toISOString()
        if (!Object.keys(update).length) return send(response, 400, { error:'No valid changes supplied.' })
        const { data:before, error:beforeError } = await supabase.from('orders').select('*').eq('id', match[1]).single()
        if (beforeError) return send(response, 404, { error:'Order not found.' })
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

  const proofSubmission = url.pathname.match(/^\/api\/orders\/([A-Z0-9-]+)\/payment-proof$/)
  if (request.method === 'POST' && proofSubmission) {
    const orderNumber = proofSubmission[1]
    if (!isOrderToken(request, orderNumber)) return send(response, 401, { error:'This payment session expired. Contact Tappy with your order number.' })
    try {
      const body = await readJson(request, 5_700_000)
      const reference = clean(body.reference, 100).replace(/\s+/g, '')
      const senderName = clean(body.senderName, 100)
      const senderPhone = clean(body.senderPhone, 32)
      const receiptMatch = typeof body.receiptData === 'string' && body.receiptData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
      if (reference.length < 6 || !senderName || !senderPhone || !receiptMatch) return send(response, 400, { error:'Add the GCash reference, sender details, and a valid receipt image.' })
      const receipt = Buffer.from(receiptMatch[2], 'base64')
      if (!receipt.length || receipt.length > 4_194_304) return send(response, 413, { error:'Receipt image must be smaller than 4 MB.' })
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
      return send(response, error.message === 'Payload too large' ? 413 : 400, { error:error.message === 'Payload too large' ? 'Receipt image must be smaller than 4 MB.' : 'Invalid payment proof.' })
    }
  }

  if (request.method !== 'POST' || url.pathname !== '/api/orders') return send(response, 404, { error:'Not found' })

  try {
    const body = await readJson(request)
    const order = {
      name:clean(body.name, 100), email:clean(body.email, 160).toLowerCase(), phone:clean(body.phone, 32),
      address:clean(body.address, 220), city:clean(body.city, 100), postal:clean(body.postal, 16),
      payment:clean(body.payment, 16), quantity:Number(body.quantity),
    }
    if (!order.name || !order.email.includes('@') || !order.phone || !order.address || !order.city || !order.postal) return send(response, 400, { error:'Complete all customer and delivery fields.' })
    if (!Number.isInteger(order.quantity) || order.quantity < 1 || order.quantity > 10) return send(response, 400, { error:'Quantity must be between 1 and 10.' })
    if (!allowedPayments.has(order.payment)) return send(response, 400, { error:'Choose a valid payment method.' })

    const orderNumber = createOrderNumber()
    const total = order.quantity * unitPrice + shippingFee
    const paymentStatus = 'awaiting_payment'
    const orderStatus = 'pending_payment_verification'
    const { data, error } = await supabase.from('orders').insert({
      order_number:orderNumber, customer_name:order.name, email:order.email, phone:order.phone,
      address:order.address, city:order.city, postal_code:order.postal, quantity:order.quantity,
      unit_price:unitPrice, shipping_fee:shippingFee, total, payment_method:order.payment,
      payment_status:paymentStatus, order_status:orderStatus,
    }).select('order_number,total,payment_method,payment_status,order_status,created_at').single()
    if (error) {
      console.error('Supabase order insert failed:', error.message)
      return send(response, 503, { error:'The order could not be saved. Please try again.' })
    }
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
    return send(response, status, { error:status === 400 ? 'Invalid request.' : 'The order could not be saved. Please try again.' })
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
