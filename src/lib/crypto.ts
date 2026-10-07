import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { serverEnv } from '@/lib/env'

const b64url = (buf: Buffer) => buf.toString('base64url')

export function randomToken(bytes = 24) {
  return b64url(randomBytes(bytes))
}

/** Compact signed payload: base64url(json).base64url(hmac). Optional expiry in seconds. */
export function signPayload(payload: Record<string, unknown>, ttlSeconds?: number): string {
  const body = { ...payload, ...(ttlSeconds ? { exp: Math.floor(Date.now() / 1000) + ttlSeconds } : {}) }
  const data = b64url(Buffer.from(JSON.stringify(body)))
  const sig = b64url(createHmac('sha256', serverEnv().appSecret).update(data).digest())
  return `${data}.${sig}`
}

export function verifyPayload<T = Record<string, unknown>>(token: string | undefined | null): T | null {
  if (!token) return null
  const [data, sig] = token.split('.')
  if (!data || !sig) return null
  const expected = createHmac('sha256', serverEnv().appSecret).update(data).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const body = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null
    return body as T
  } catch {
    return null
  }
}

export function hmacBase64(secret: string, body: string) {
  return createHmac('sha256', secret).update(body).digest('base64')
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
