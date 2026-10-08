import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { env } from '@/lib/env'

/** End-user IP as seen by Vercel (it overwrites x-forwarded-for, so this is trustworthy there). */
export function clientIp(h: Headers): string | null {
  return h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || null
}

/**
 * Cookie-bound Supabase client for **auth only** (session refresh / sign-out).
 * Supabase Auth rate-limits per IP; called from Vercel, every user would share Vercel's IP.
 * With the secret key we may forward the visitor's IP (`sb-forwarded-for`) so limits apply
 * per user — enable "IP Address Forwarding" in Supabase → Authentication → Rate Limits.
 * Never use this client for table queries (with a secret key and no session it is service role).
 */
export async function createClient() {
  const cookieStore = await cookies()
  const ip = clientIp(await headers())
  const secret = process.env.SUPABASE_SECRET_KEY
  return createServerClient(env.supabaseUrl, secret || env.supabasePublishableKey, {
    global: { headers: secret && ip ? { 'sb-forwarded-for': ip } : {} },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  })
}
