import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'

const port = 19000 + Math.floor(Math.random() * 500)

async function waitForServer(child) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Admin auth test server did not start')), 10_000)
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes(`127.0.0.1:${port}`)) {
        clearTimeout(timer)
        resolve()
      }
    })
    child.once('error', reject)
    child.once('exit', (code) => code && reject(new Error(`Test server exited with ${code}`)))
  })
}

test('admin session uses an HttpOnly cookie and can be revoked', async (t) => {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT:String(port), SUPABASE_URL:'https://example.supabase.co', SUPABASE_SECRET_KEY:'test-secret', ADMIN_PASSWORD:'test-password', ADMIN_TOKEN_SECRET:'test-admin-secret', RESEND_API_KEY:'' },
    stdio:['ignore','pipe','pipe'],
  })
  t.after(() => child.kill())
  await waitForServer(child)

  const login = await fetch(`http://127.0.0.1:${port}/api/admin/login`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ password:'test-password' }) })
  assert.equal(login.status, 200)
  const setCookie = login.headers.get('set-cookie') || ''
  assert.match(setCookie, /^tappy_admin=.*HttpOnly/)
  const cookie = setCookie.split(';', 1)[0]

  const session = await fetch(`http://127.0.0.1:${port}/api/admin/session`, { headers:{ cookie } })
  assert.equal(session.status, 200)
  const protectedOrders = await fetch(`http://127.0.0.1:${port}/api/admin/orders`)
  assert.equal(protectedOrders.status, 401)

  const logout = await fetch(`http://127.0.0.1:${port}/api/admin/logout`, { method:'POST', headers:{ cookie } })
  assert.equal(logout.status, 200)
  assert.match(logout.headers.get('set-cookie') || '', /Max-Age=0/)

  const expired = await fetch(`http://127.0.0.1:${port}/api/admin/session`)
  assert.equal(expired.status, 401)
})

test('admin login rejects bad passwords and rate-limits repeated attempts', async (t) => {
  const testPort = port + 1
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT:String(testPort), SUPABASE_URL:'https://example.supabase.co', SUPABASE_SECRET_KEY:'test-secret', ADMIN_PASSWORD:'test-password', ADMIN_TOKEN_SECRET:'test-admin-secret', RESEND_API_KEY:'' },
    stdio:['ignore','pipe','pipe'],
  })
  t.after(() => child.kill())
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Rate-limit test server did not start')), 10_000)
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes(`127.0.0.1:${testPort}`)) { clearTimeout(timer); resolve() }
    })
    child.once('error', reject)
    child.once('exit', (code) => code && reject(new Error(`Test server exited with ${code}`)))
  })

  const attempt = () => fetch(`http://127.0.0.1:${testPort}/api/admin/login`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ password:'wrong-password' }) })
  for (let index = 0; index < 5; index += 1) assert.equal((await attempt()).status, 401)
  assert.equal((await attempt()).status, 429)
})

test('Resend webhook rejects unsigned requests', async (t) => {
  const testPort = port + 2
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT:String(testPort), SUPABASE_URL:'https://example.supabase.co', SUPABASE_SECRET_KEY:'test-secret', ADMIN_PASSWORD:'test-password', ADMIN_TOKEN_SECRET:'test-admin-secret', RESEND_API_KEY:'test-resend-key', RESEND_WEBHOOK_SECRET:'whsec_test-secret' },
    stdio:['ignore','pipe','pipe'],
  })
  t.after(() => child.kill())
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Webhook test server did not start')), 10_000)
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes(`127.0.0.1:${testPort}`)) { clearTimeout(timer); resolve() }
    })
    child.once('error', reject)
    child.once('exit', (code) => code && reject(new Error(`Test server exited with ${code}`)))
  })

  const response = await fetch(`http://127.0.0.1:${testPort}/api/webhooks/resend`, { method:'POST', headers:{ 'content-type':'application/json' }, body:'{}' })
  assert.equal(response.status, 401)
})

test('order API rejects incomplete and invalid quantity payloads', async (t) => {
  const testPort = port + 3
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT:String(testPort), SUPABASE_URL:'https://example.supabase.co', SUPABASE_SECRET_KEY:'test-secret', ADMIN_PASSWORD:'test-password', ADMIN_TOKEN_SECRET:'test-admin-secret' },
    stdio:['ignore','pipe','pipe'],
  })
  t.after(() => child.kill())
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Order test server did not start')), 10_000)
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes(`127.0.0.1:${testPort}`)) { clearTimeout(timer); resolve() }
    })
    child.once('error', reject)
    child.once('exit', (code) => code && reject(new Error(`Test server exited with ${code}`)))
  })

  const submit = (payload) => fetch(`http://127.0.0.1:${testPort}/api/orders`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(payload) })
  const incomplete = await submit({ name:'Test Customer', email:'test@example.com', quantity:1, payment:'gcash' })
  assert.equal(incomplete.status, 400)
  const invalidQuantity = await submit({ name:'Test Customer', email:'test@example.com', phone:'09123456789', address:'1 Test Street', city:'Quezon City', province:'Metro Manila', postal:'1100', quantity:11, payment:'gcash' })
  assert.equal(invalidQuantity.status, 400)
})

test('payment proof requires a valid order session and receipt data', async (t) => {
  const testPort = port + 4
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT:String(testPort), SUPABASE_URL:'https://example.supabase.co', SUPABASE_SECRET_KEY:'test-secret', ADMIN_PASSWORD:'test-password', ADMIN_TOKEN_SECRET:'test-admin-secret' },
    stdio:['ignore','pipe','pipe'],
  })
  t.after(() => child.kill())
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Payment proof test server did not start')), 10_000)
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes(`127.0.0.1:${testPort}`)) { clearTimeout(timer); resolve() }
    })
    child.once('error', reject)
    child.once('exit', (code) => code && reject(new Error(`Test server exited with ${code}`)))
  })

  const orderNumber = 'TAP-20990101-ABC123'
  const payload = Buffer.from(JSON.stringify({ orderNumber, exp:Date.now() + 60_000 })).toString('base64url')
  const token = `${payload}.${createHmac('sha256', 'test-admin-secret').update(payload).digest('base64url')}`
  const endpoint = `http://127.0.0.1:${testPort}/api/orders/${orderNumber}/payment-proof`
  assert.equal((await fetch(endpoint, { method:'POST', headers:{ 'content-type':'application/json' }, body:'{}' })).status, 401)
  const invalidProof = await fetch(endpoint, { method:'POST', headers:{ authorization:`Bearer ${token}`, 'content-type':'application/json' }, body:JSON.stringify({ reference:'123456', senderName:'Test Customer', senderPhone:'09123456789' }) })
  assert.equal(invalidProof.status, 400)
})
