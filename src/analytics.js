const sessionKey = 'tappy-analytics-session'

function sessionId() {
  try {
    const existing = window.sessionStorage.getItem(sessionKey)
    if (existing) return existing
    const created = crypto.randomUUID()
    window.sessionStorage.setItem(sessionKey, created)
    return created
  } catch { return crypto.randomUUID() }
}

export function track(eventName, data = {}) {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return
  const payload = JSON.stringify({ eventId:crypto.randomUUID(), eventName, sessionId:sessionId(), path:window.location.pathname, ...data })
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', new Blob([payload], { type:'application/json' }))
    return
  }
  fetch('/api/analytics', { method:'POST', headers:{ 'content-type':'application/json' }, body:payload, keepalive:true }).catch(() => {})
}
