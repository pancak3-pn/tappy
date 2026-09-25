import { createHmac, timingSafeEqual } from 'node:crypto'

function safeEqual(left, right) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function cookieValue(request, name) {
  const entry = (request.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

export function createAuth(secret, { secureCookies = false } = {}) {
  const sign = (payload) => {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = createHmac('sha256', secret).update(encoded).digest('base64url')
    return `${encoded}.${signature}`
  }
  const verify = (token) => {
    const [payload, signature] = String(token || '').split('.')
    if (!payload || !signature) return null
    const expected = createHmac('sha256', secret).update(payload).digest('base64url')
    if (!safeEqual(signature, expected)) return null
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
      return Number(data.exp) > Date.now() ? data : null
    } catch { return null }
  }
  const adminCookie = (token, maxAge = 8 * 60 * 60) => `tappy_admin=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Strict${secureCookies ? '; Secure' : ''}`
  const clearAdminCookie = () => `tappy_admin=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict${secureCookies ? '; Secure' : ''}`
  return {
    signAdminToken: () => sign({ role:'admin', exp:Date.now() + 8 * 60 * 60 * 1000 }),
    signOrderToken: (orderNumber) => sign({ orderNumber, exp:Date.now() + 2 * 60 * 60 * 1000 }),
    adminCookie,
    clearAdminCookie,
    isAdmin: (request) => verify(cookieValue(request, 'tappy_admin'))?.role === 'admin',
    isOrderToken: (request, orderNumber) => verify(request.headers.authorization?.replace(/^Bearer\s+/i, ''))?.orderNumber === orderNumber,
  }
}
