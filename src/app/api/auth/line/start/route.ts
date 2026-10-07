import { NextResponse, type NextRequest } from 'next/server'
import { getViewer } from '@/lib/auth'
import { env, lineLoginEnabled } from '@/lib/env'
import { randomToken, signPayload } from '@/lib/crypto'
import { lineAuthorizeUrl } from '@/lib/line/login'

const LINE_COOKIE = 'msc_line_oauth'

// /api/auth/line/start?next=/path            → sign in / sign up with LINE
// /api/auth/line/start?mode=link&next=/path  → link LINE to the signed-in account
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const rawNext = sp.get('next') || '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
  if (!lineLoginEnabled()) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('ยังไม่ได้ตั้งค่า LINE Login')}`, request.url))
  }
  const viewer = await getViewer()
  const mode = sp.get('mode') === 'link' || viewer ? 'link' : 'login'
  if (mode === 'link' && !viewer) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, request.url))
  }
  const state = randomToken(16)
  const nonce = randomToken(16)
  const redirectUri = `${env.siteUrl}/api/auth/line/callback`
  const res = NextResponse.redirect(lineAuthorizeUrl({ state, nonce, redirectUri }))
  res.cookies.set(LINE_COOKIE, signPayload({ state, nonce, next, mode, uid: viewer?.userId ?? null }, 600), {
    httpOnly: true,
    secure: env.siteUrl.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}
