import { NextResponse, type NextRequest } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { safeEqual } from '@/lib/crypto'
import { notifyUsers, sendDigests } from '@/lib/notify'
import { thaiDate, todayBangkok } from '@/lib/format'

export const maxDuration = 300

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Runs daily at 08:00 Asia/Bangkok (vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: NextRequest) {
  const secret = serverEnv().cronSecret
  const auth = request.headers.get('authorization') || ''
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ ok: false }, { status: 401 })

  const db = adminClient()
  const target = addDays(todayBangkok(), 3)

  // 1) "เตือนก่อนปิดรับ" — saved events closing in 3 days.
  const { data: events } = await db.from('events').select('id, slug, title, deadline, poster_url').eq('status', 'published').eq('deadline', target)
  let reminded = 0
  for (const e of events || []) {
    const { data: saves } = await db.from('saved_events').select('user_id').eq('event_id', e.id).is('reminded_at', null)
    const ids = (saves || []).map((s) => s.user_id)
    if (!ids.length) continue
    await notifyUsers(ids, 'reminders', {
      altText: `อีก 3 วันปิดรับสมัคร ${e.title}`,
      title: 'อีก 3 วันปิดรับสมัคร',
      subtitle: `${e.title} ที่คุณบันทึกไว้ ปิดรับ ${thaiDate(e.deadline)}`,
      imageUrl: e.poster_url,
      actions: [{ type: 'uri', label: 'สมัครเลย →', url: `/opportunities/${e.slug}` }],
    })
    await db.from('saved_events').update({ reminded_at: new Date().toISOString() }).eq('event_id', e.id).in('user_id', ids)
    reminded += ids.length
  }

  // 2) Daily digests for users who chose "สรุปวันละครั้ง".
  const digests = await sendDigests()

  // 3) Housekeeping.
  await db.from('search_cache').delete().lt('created_at', new Date(Date.now() - 2 * 86_400_000).toISOString())

  return NextResponse.json({ ok: true, reminded, digests })
}
