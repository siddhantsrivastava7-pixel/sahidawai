/**
 * Simple in-memory rate limiter (per-IP, per-minute window).
 * Resets automatically — no external dependency required.
 * Note: counter is per-process; on Vercel each lambda instance tracks its own window.
 */

interface Counter {
  count: number
  resetAt: number
}

const counters = new Map<string, Counter>()

export function checkRateLimit(ip: string, maxPerMinute: number): boolean {
  const now = Date.now()
  const entry = counters.get(ip)

  if (!entry || now > entry.resetAt) {
    counters.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }

  if (entry.count >= maxPerMinute) return false

  entry.count++
  return true
}

export function rateLimitHeaders(ip: string, maxPerMinute: number): Record<string, string> {
  const entry = counters.get(ip)
  if (!entry) return {}
  const retryAfter = Math.ceil((entry.resetAt - Date.now()) / 1000)
  return {
    'X-RateLimit-Limit': String(maxPerMinute),
    'X-RateLimit-Remaining': String(Math.max(0, maxPerMinute - entry.count)),
    'Retry-After': String(retryAfter),
  }
}
