import { NextResponse, type NextRequest } from 'next/server'
import { getViewer } from '@/lib/auth'
import { accountLinkUrl, isLinkToken, linkPageUrl, rememberPendingLink } from '@/lib/line/link'

// Personal link sent by the LINE OA: /line/link?linkToken=...
// Signed in → straight to LINE's account-link dialog. Otherwise → sign up / sign in with email first.
export async function GET(request: NextRequest) {
  const linkToken = request.nextUrl.searchParams.get('linkToken')
  if (!isLinkToken(linkToken)) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('ลิงก์เชื่อม LINE ไม่ถูกต้อง กลับไปที่แชต LINE แล้วพิมพ์ “เชื่อมบัญชี” เพื่อขอลิงก์ใหม่')}`, request.url))
  }
  const viewer = await getViewer()
  if (viewer) return NextResponse.redirect(await accountLinkUrl(viewer.userId, linkToken))
  await rememberPendingLink(linkToken)
  return NextResponse.redirect(new URL(`/login?from=line&next=${encodeURIComponent(linkPageUrl(linkToken))}`, request.url))
}
