import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { verifyPayload } from '@/lib/crypto'
import { env } from '@/lib/env'
import { exchangeLineCode, lineFriendshipStatus } from '@/lib/line/login'
import { linkLineToUser } from '@/lib/line/link'
import { getViewer } from '@/lib/auth'
import { isOaFriend, pushMessage } from '@/lib/line/messaging'
import { linkedProfile, welcome } from '@/lib/line/bot'

const LINE_COOKIE = 'msc_line_oauth'
type Flow = { state: string; nonce: string; next: string; uid: string }

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const jar = await cookies()
  const flow = verifyPayload<Flow>(jar.get(LINE_COOKIE)?.value)
  jar.delete(LINE_COOKIE)
  const back = (q: string, next = '/settings/notifications') =>
    NextResponse.redirect(new URL(`${next}${next.includes('?') ? '&' : '?'}${q}`, request.url))

  if (!flow) return back(`line_error=${encodeURIComponent('หมดเวลาเชื่อม LINE กรุณาลองใหม่')}`)
  if (sp.get('error')) return back(`line_error=${encodeURIComponent('ยกเลิกการเชื่อม LINE')}`, flow.next)
  const code = sp.get('code')
  if (!code || sp.get('state') !== flow.state) return back(`line_error=${encodeURIComponent('คำขอไม่ถูกต้อง กรุณาลองใหม่')}`, flow.next)

  const viewer = await getViewer()
  if (!viewer || viewer.userId !== flow.uid) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(flow.next)}`, request.url))
  }
  try {
    const identity = await exchangeLineCode(code, `${env.siteUrl}/api/auth/line/callback`, flow.nonce)
    const friend = await lineFriendshipStatus(identity.accessToken).catch(() => null)
    await linkLineToUser(viewer.userId, identity.sub, { displayName: identity.name, picture: identity.picture, friend })
    // Just added as a friend on the consent screen → the follow event greets them (free reply).
    // Already a friend → one push: welcome + "pick your interests" (one push = one message).
    const justAdded = sp.get('friendship_status_changed') === 'true'
    const isFriend = friend ?? (await isOaFriend(identity.sub))
    if (isFriend && !justAdded) {
      const profile = await linkedProfile(identity.sub)
      await pushMessage(identity.sub, await welcome(identity.sub, profile, true)).catch((err) => console.error('LINE welcome push', err))
    }
  } catch (err) {
    console.error(err)
    return back(`line_error=${encodeURIComponent('เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่')}`, flow.next)
  }
  return back('linked=1', flow.next)
}
