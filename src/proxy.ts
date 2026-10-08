import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Keeps the Supabase session cookie fresh. getClaims() verifies the JWT locally (ES256 keys,
// JWKS cached) and only calls Supabase Auth when the access token has expired and must be
// refreshed — so normal page views cost no Auth request. The visitor's IP is forwarded so the
// per-IP refresh limit applies to each user rather than to Vercel's shared IP.
// Old production address → the custom domain, once NEXT_PUBLIC_SITE_URL points there.
// Preview deployments and API routes (cron, webhooks) are left alone.
const LEGACY_HOST = 'mahidol-startup-club.vercel.app'
const CANONICAL = (() => {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SITE_URL || '')
    return u.hostname === LEGACY_HOST || u.hostname === 'localhost' ? null : u
  } catch {
    return null
  }
})()

export async function proxy(request: NextRequest) {
  if (CANONICAL && request.headers.get('host') === LEGACY_HOST && !request.nextUrl.pathname.startsWith('/api/')) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL)
    return NextResponse.redirect(url, 308)
  }
  // No session cookie → nothing to refresh (most anonymous traffic exits here).
  if (!request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) return NextResponse.next()

  let response = NextResponse.next({ request })
  const secret = process.env.SUPABASE_SECRET_KEY
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: secret && ip ? { 'sb-forwarded-for': ip } : {} },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  await supabase.auth.getClaims()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|assets/|api/line/webhook|api/cron|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
