import { NextResponse, type NextRequest } from 'next/server'
import { getViewer } from '@/lib/auth'
import { env, lineLoginEnabled } from '@/lib/env'
import { randomToken, signPayload } from '@/lib/crypto'
import { lineAuthorizeUrl } from '@/lib/line/login'

const LINE_COOKIE = 'msc_line_oauth'

// "🔗 เชื่อมต่อ LINE" — LINE confirms the account, we store its User ID on the signed-in email account.
// LINE is never used to sign in.
export async function GET(request: NextRequest) {
  const rawNext = request.nextUrl.searchParams.get('next') || '/settings/notifications'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/settings/notifications'
  const viewer = await getViewer()
  if (!viewer) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, request.url))
  if (!lineLoginEnabled()) return NextResponse.redirect(new URL('/settings/notifications#line', request.url))
  const state = randomToken(16)
  const nonce = randomToken(16)
  const res = NextResponse.redirect(lineAuthorizeUrl({ state, nonce, redirectUri: `${env.siteUrl}/api/auth/line/callback` }))
  res.cookies.set(LINE_COOKIE, signPayload({ state, nonce, next, uid: viewer.userId }, 600), {
    httpOnly: true,
    secure: env.siteUrl.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}
