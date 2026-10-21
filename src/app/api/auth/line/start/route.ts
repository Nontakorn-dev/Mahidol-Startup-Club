import { NextResponse, type NextRequest } from 'next/server'
import { getViewer } from '@/lib/auth'
import { env, lineLoginEnabled } from '@/lib/env'
import { randomToken } from '@/lib/crypto'
import { adminClient } from '@/lib/supabase/admin'
import { lineAuthorizeUrl } from '@/lib/line/login'
import { safeNext } from '@/lib/safe-next'
import { withinLimit } from '@/lib/rate-limit'

// "🔗 เชื่อมต่อ LINE" — LINE confirms the account, we store its User ID on the signed-in account.
// LINE is never used to sign in. The flow state lives in the database (not a cookie): on phones
// LINE often comes back inside its own in-app browser, which has none of this site's cookies.
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get('next'), '/me')
  const viewer = await getViewer()
  if (!viewer) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, request.url))
  if (!lineLoginEnabled()) return NextResponse.redirect(new URL('/me#line', request.url))
  if (!(await withinLimit(`line-start:${viewer.userId}`, 10, 3600))) {
    return NextResponse.redirect(new URL(`${next}${next.includes('?') ? '&' : '?'}line_error=${encodeURIComponent('ลองเชื่อม LINE ถี่เกินไป กรุณารอสักครู่')}`, request.url))
  }
  const state = randomToken(24)
  const nonce = randomToken(16)
  const db = adminClient()
  await db.from('line_login_states').delete().lt('created_at', new Date(Date.now() - 24 * 3_600_000).toISOString())
  const { error } = await db.from('line_login_states').insert({ state, user_id: viewer.userId, nonce, next })
  if (error) return NextResponse.redirect(new URL(`${next}${next.includes('?') ? '&' : '?'}line_error=${encodeURIComponent('เริ่มเชื่อม LINE ไม่สำเร็จ กรุณาลองใหม่')}`, request.url))
  return NextResponse.redirect(lineAuthorizeUrl({ state, nonce, redirectUri: `${env.siteUrl}/api/auth/line/callback` }))
}
