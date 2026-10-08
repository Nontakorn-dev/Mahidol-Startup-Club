import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { isOaFriend } from '@/lib/line/messaging'

// Polled by the "เชื่อมต่อ LINE" card: while the user sends their code in the OA chat, and
// after linking until they have added the OA as a friend (asked live from LINE, then saved).
export async function GET() {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ linked: false }, { status: 401 })
  const p = viewer.profile
  let friend = p.line_is_friend
  if (p.line_user_id && !friend && (await isOaFriend(p.line_user_id))) {
    friend = true
    await adminClient().from('profiles').update({ line_is_friend: true }).eq('id', p.id)
  }
  return NextResponse.json({ linked: Boolean(p.line_user_id), friend })
}
