import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { adminClient } from '@/lib/supabase/admin'
import { exchangeLineCode, lineFriendshipStatus } from '@/lib/line/login'
import { linkLineToUser } from '@/lib/line/link'
import { isOaFriend, pushMessage } from '@/lib/line/messaging'
import { linkedProfile, welcome } from '@/lib/line/bot'
import { getViewer } from '@/lib/auth'
import { randomToken } from '@/lib/crypto'

const STATE_TTL_MS = 10 * 60_000

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const page = (q: string) => NextResponse.redirect(new URL(`/line/linked?${q}`, request.url))
  const state = sp.get('state') || ''
  // One-time, 10-minute state stored at /api/auth/line/start — works in any browser.
  const { data: flow } = state
    ? await adminClient()
        .from('line_login_states')
        .update({ used_at: new Date().toISOString() })
        .eq('state', state)
        .is('used_at', null)
        .gte('created_at', new Date(Date.now() - STATE_TTL_MS).toISOString())
        .select('user_id, nonce, next')
        .maybeSingle()
    : { data: null }
  if (!flow) return page(`error=${encodeURIComponent('ลิงก์หมดอายุหรือถูกใช้ไปแล้ว — กลับไปที่เว็บแล้วกด “เชื่อมต่อ LINE” อีกครั้ง')}`)
  if (sp.get('error') || !sp.get('code')) return page(`error=${encodeURIComponent('ยกเลิกการเชื่อม LINE')}`)

  let displayName: string | null = null
  try {
    const identity = await exchangeLineCode(sp.get('code')!, `${env.siteUrl}/api/auth/line/callback`, flow.nonce)
    const friend = (await lineFriendshipStatus(identity.accessToken).catch(() => null)) ?? (await isOaFriend(identity.sub))
    await linkLineToUser(flow.user_id, identity.sub, { displayName: identity.name, picture: identity.picture, friend })
    displayName = identity.name
    // Confirmation in LINE (also tells the owner which account this LINE now belongs to).
    // Someone who just added the OA on the consent screen is greeted by the follow event
    // instead — a free reply — so this push happens at most once per link, only for existing friends.
    const justAdded = sp.get('friendship_status_changed') === 'true'
    if (friend && !justAdded) {
      const profile = await linkedProfile(identity.sub)
      await pushMessage(identity.sub, await welcome(identity.sub, profile, true)).catch((err) => console.error('LINE welcome push', err))
    }
  } catch (err) {
    console.error('LINE link failed', err)
    return page(`error=${encodeURIComponent('เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่')}`)
  }

  // Same browser as the website session → back to where they started. Otherwise (LINE's in-app
  // browser on phones) → a page that says it worked; the original tab refreshes itself.
  // Next stop: pick interests on the website, then back to where they started.
  const interests = `/settings/interests?linked=1&next=${encodeURIComponent(flow.next as string)}`
  const viewer = await getViewer()
  if (viewer?.userId === flow.user_id) return NextResponse.redirect(new URL(interests, request.url))
  // Different browser (LINE's in-app browser on phones): sign them in here with a one-time
  // token so they don't have to log in again.
  const token = randomToken(24)
  await adminClient().from('line_login_states').update({ continue_token: token }).eq('state', state)
  return page(`ok=1&t=${token}${displayName ? `&name=${encodeURIComponent(displayName)}` : ''}`)
}
