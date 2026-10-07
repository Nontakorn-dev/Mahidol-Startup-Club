import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { verifyPayload } from '@/lib/crypto'
import { env } from '@/lib/env'
import { exchangeLineCode, lineFriendshipStatus, type LineIdentity } from '@/lib/line/login'
import { adminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getViewer } from '@/lib/auth'
import { notifyUsers } from '@/lib/notify'

const LINE_COOKIE = 'msc_line_oauth'
type Flow = { state: string; nonce: string; next: string; mode: 'login' | 'link'; uid: string | null }

const fail = (request: NextRequest, msg: string, next = '/') =>
  NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`, request.url))

function lineFields(id: LineIdentity, friend: boolean | null) {
  return {
    line_user_id: id.sub,
    line_display_name: id.name,
    line_picture_url: id.picture,
    line_linked_at: new Date().toISOString(),
    ...(friend === null ? {} : { line_is_friend: friend }),
  }
}

async function welcomeOnLine(userId: string) {
  await notifyUsers([userId], 'system', {
    altText: 'เชื่อมบัญชี LINE กับ Mahidol Startup Club แล้ว',
    headerBar: 'เชื่อม LINE สำเร็จ',
    title: 'คุณจะได้รับแจ้งเตือนจากเว็บผ่าน LINE นี้',
    subtitle: 'เลือกเรื่องที่อยากรู้ได้ในหน้าตั้งค่า · พิมพ์สิ่งที่อยากทำในแชตนี้ได้เลย เช่น “หาทีมลง TED Youth”',
    actions: [{ type: 'uri', label: 'ตั้งค่าแจ้งเตือน', url: '/settings/notifications' }],
  }, { allowEmail: false })
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const jar = await cookies()
  const flow = verifyPayload<Flow>(jar.get(LINE_COOKIE)?.value)
  jar.delete(LINE_COOKIE)
  if (!flow) return fail(request, 'เซสชัน LINE หมดอายุ กรุณาลองใหม่')
  if (sp.get('error')) return fail(request, 'ยกเลิกการเข้าสู่ระบบด้วย LINE', flow.next)
  const code = sp.get('code')
  if (!code || sp.get('state') !== flow.state) return fail(request, 'คำขอไม่ถูกต้อง กรุณาลองใหม่', flow.next)

  let identity: LineIdentity
  try {
    identity = await exchangeLineCode(code, `${env.siteUrl}/api/auth/line/callback`, flow.nonce)
  } catch (err) {
    console.error(err)
    return fail(request, 'เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่', flow.next)
  }
  const friend = await lineFriendshipStatus(identity.accessToken).catch(() => null)
  const db = adminClient()
  const { data: owner } = await db.from('profiles').select('id').eq('line_user_id', identity.sub).maybeSingle()

  // ---------------------------------------------------------------- link to current account
  if (flow.mode === 'link') {
    const viewer = await getViewer()
    if (!viewer || viewer.userId !== flow.uid) return fail(request, 'กรุณาเข้าสู่ระบบก่อนเชื่อม LINE', flow.next)
    if (owner && owner.id !== viewer.userId) {
      return NextResponse.redirect(
        new URL(`/settings/notifications?line_error=${encodeURIComponent('บัญชี LINE นี้ผูกกับบัญชีอื่นบนเว็บแล้ว')}`, request.url),
      )
    }
    await db
      .from('profiles')
      .update({
        ...lineFields(identity, friend),
        ...(viewer.profile.avatar_url ? {} : { avatar_url: identity.picture }),
      })
      .eq('id', viewer.userId)
    if (friend) await welcomeOnLine(viewer.userId).catch(console.error)
    const dest = flow.next && flow.next !== '/' ? flow.next : '/settings/notifications'
    return NextResponse.redirect(new URL(`${dest}${dest.includes('?') ? '&' : '?'}linked=1`, request.url))
  }

  // ---------------------------------------------------------------- sign in / sign up
  let userId = owner?.id ?? null
  let email: string | null = null
  if (!userId && identity.email) {
    // LINE verified this email — attach LINE to the existing email account if there is one.
    const { data: byEmail } = await db
      .from('profiles')
      .select('id')
      .eq('email', identity.email.toLowerCase())
      .eq('email_is_placeholder', false)
      .maybeSingle()
    userId = byEmail?.id ?? null
  }
  if (!userId) {
    const placeholder = !identity.email
    const newEmail = identity.email?.toLowerCase() ?? `line-${identity.sub.toLowerCase()}@users.line.invalid`
    const { data: created, error } = await db.auth.admin.createUser({
      email: newEmail,
      email_confirm: true,
      user_metadata: { first_name: identity.name ?? '', avatar_url: identity.picture, email_is_placeholder: placeholder, provider: 'line' },
    })
    if (error || !created.user) {
      console.error(error)
      return fail(request, 'สร้างบัญชีจาก LINE ไม่สำเร็จ', flow.next)
    }
    userId = created.user.id
  }
  await db.from('profiles').update(lineFields(identity, friend)).eq('id', userId)

  const { data: authUser } = await db.auth.admin.getUserById(userId)
  email = authUser.user?.email ?? null
  if (!email) return fail(request, 'บัญชีนี้ไม่มีอีเมลสำหรับเข้าสู่ระบบ', flow.next)

  // Mint a Supabase session for this user without sending any email.
  const { data: link, error: linkErr } = await db.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkErr || !link.properties?.hashed_token) {
    console.error(linkErr)
    return fail(request, 'เข้าสู่ระบบไม่สำเร็จ', flow.next)
  }
  const supabase = await createClient()
  const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
  if (otpErr) {
    console.error(otpErr)
    return fail(request, 'เข้าสู่ระบบไม่สำเร็จ', flow.next)
  }
  if (!owner && friend) await welcomeOnLine(userId).catch(console.error)
  return NextResponse.redirect(new URL(`/auth/after?next=${encodeURIComponent(flow.next)}`, request.url))
}
