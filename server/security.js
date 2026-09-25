import { timingSafeEqual } from 'node:crypto'

export function safeEqual(left, right) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function createRateLimiter(supabase) {
  const buckets = new Map()
  const clientIp = (request) => {
    const forwarded = request.headers['x-forwarded-for']
    if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim()
    return request.socket?.remoteAddress || 'unknown'
  }
  const rateLimit = async (key, limit, windowMs) => {
    const { data, error } = await supabase.rpc('consume_rate_limit', { p_key:key, p_limit:limit, p_window_seconds:Math.ceil(windowMs / 1000) })
    if (!error && typeof data === 'boolean') return data
    const now = Date.now()
    let bucket = buckets.get(key)
    if (!bucket || now >= bucket.resetAt) {
      if (buckets.size > 5000) for (const [entryKey, entry] of buckets) if (now >= entry.resetAt) buckets.delete(entryKey)
      bucket = { count:0, resetAt:now + windowMs }
      buckets.set(key, bucket)
    }
    bucket.count += 1
    return bucket.count <= limit
  }
  return { clientIp, rateLimit }
}
