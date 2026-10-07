import { NextResponse, after } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { verifyPayload } from '@/lib/crypto'
import { eventsCarousel, noticeFlex, replyMessage, textMessage, verifyLineSignature } from '@/lib/line/messaging'
import { parseIntent } from '@/lib/ai/intent'
import { runSearch } from '@/lib/search'
import { respondToRequest } from '@/lib/messaging'
import { listPublishedEvents } from '@/lib/data/events'
import { deadlineLine, isClosed } from '@/lib/format'
import { CATEGORIES } from '@/lib/constants'

export const maxDuration = 30

type LineEvent = {
  type: string
  replyToken?: string
  source: { type: string; userId?: string }
  message?: { type: string; text?: string }
  postback?: { data: string }
}

const QUICK = [
  { label: 'งานแข่งที่เปิดอยู่', text: 'งานแข่ง' },
  { label: 'หาทีม', url: '/teams?src=line' },
  { label: 'ตั้งค่าแจ้งเตือน', url: '/settings/notifications?src=line' },
]

const loginUrl = (next: string) => `/api/auth/line/start?next=${encodeURIComponent(next)}`

async function profileByLine(lineUserId: string) {
  const { data } = await adminClient().from('profiles').select('id, first_name').eq('line_user_id', lineUserId).maybeSingle()
  return data
}

async function onFollow(e: LineEvent) {
  const uid = e.source.userId!
  const db = adminClient()
  const profile = await profileByLine(uid)
  if (profile) await db.from('profiles').update({ line_is_friend: true }).eq('id', profile.id)
  if (!e.replyToken) return
  if (profile) {
    await replyMessage(e.replyToken, [
      textMessage(
        `ยินดีต้อนรับกลับ ${profile.first_name || ''} 🎉\nบัญชีเว็บของคุณเชื่อมกับ LINE นี้แล้ว — เราจะแจ้งเตือนคำชวนเข้าทีมและงานแข่งที่ตรงกับคุณทางนี้\n\nลองพิมพ์สิ่งที่อยากทำได้เลย เช่น “หาทีมลง TED Youth ฉันทำ UX ได้”`,
        QUICK,
      ),
    ])
  } else {
    await replyMessage(e.replyToken, [
      noticeFlex({
        altText: 'ยินดีต้อนรับสู่ Mahidol Startup Club',
        headerBar: 'ยินดีต้อนรับสู่ Mahidol Startup Club',
        title: 'เชื่อมบัญชีเว็บกับ LINE เพื่อรับแจ้งเตือน',
        subtitle: 'แตะปุ่มด้านล่างเพื่อเข้าสู่ระบบ/สมัครด้วย LINE ได้ในแตะเดียว ถ้าเคยสมัครด้วยอีเมล ให้เข้าสู่ระบบบนเว็บแล้วกด “เชื่อม LINE” ในหน้าตั้งค่า',
        actions: [
          { type: 'uri', label: 'เชื่อมบัญชี', url: loginUrl('/settings/notifications') },
          { type: 'uri', label: 'ดูงานแข่ง', url: '/opportunities?src=line' },
        ],
      }),
    ])
  }
}

async function onUnfollow(e: LineEvent) {
  const profile = await profileByLine(e.source.userId!)
  if (profile) await adminClient().from('profiles').update({ line_is_friend: false }).eq('id', profile.id)
}

async function onPostback(e: LineEvent) {
  const data = verifyPayload<{ a: string; c: string; u: string }>(e.postback?.data)
  if (!data || !e.replyToken) return
  const profile = await profileByLine(e.source.userId!)
  if (!profile || profile.id !== data.u) {
    await replyMessage(e.replyToken, [textMessage('ปุ่มนี้ใช้ได้เฉพาะบัญชีที่ได้รับคำขอ กรุณาเปิดบนเว็บแทน', [{ label: 'เปิดกล่องข้อความ', url: '/inbox' }])])
    return
  }
  if (data.a !== 'accept' && data.a !== 'decline') return
  try {
    const result = await respondToRequest(data.c, profile.id, data.a === 'accept')
    await replyMessage(e.replyToken, [
      textMessage(`${result} ✓${data.a === 'accept' ? '\nเริ่มคุยต่อบนเว็บได้เลย' : ''}`, [{ label: 'เปิดแชต', url: `/inbox?c=${data.c}&src=line` }]),
    ])
  } catch (err) {
    await replyMessage(e.replyToken, [textMessage((err as Error).message)])
  }
}

async function replyOpenEvents(replyToken: string) {
  const events = (await listPublishedEvents()).filter((ev) => !isClosed(ev.deadline)).slice(0, 8)
  if (!events.length) {
    await replyMessage(replyToken, [textMessage('ตอนนี้ยังไม่มีงานที่เปิดรับ — เราจะแจ้งทันทีที่มีงานใหม่', QUICK)])
    return
  }
  await replyMessage(replyToken, [
    eventsCarousel(
      'งานแข่ง & ทุนที่เปิดรับอยู่',
      events.map((ev) => ({
        title: ev.title,
        subtitle: `${CATEGORIES[ev.category]} · ${deadlineLine(ev.deadline, ev.open_note)}`,
        imageUrl: ev.poster_url,
        url: `/opportunities/${ev.slug}?src=line`,
        badge: ev.is_club ? 'จากชมรม' : undefined,
      })),
      '/opportunities?src=line',
    ),
  ])
}

async function onText(e: LineEvent) {
  const text = (e.message?.text || '').trim()
  if (!e.replyToken || !text) return
  if (/^(งานแข่ง|ทุน|งาน|events?)$/i.test(text)) return replyOpenEvents(e.replyToken)
  if (/^(ตั้งค่า|แจ้งเตือน|settings?)$/i.test(text)) {
    return replyMessage(e.replyToken, [textMessage('ตั้งค่าเรื่องที่อยากรับแจ้งเตือนได้ที่นี่', [{ label: 'ตั้งค่าแจ้งเตือน', url: '/settings/notifications?src=line' }])])
  }
  if (/^(ทีม|หาทีม|เพื่อนร่วมทีม)$/i.test(text)) {
    return replyMessage(e.replyToken, [textMessage('ดูคนที่กำลังหาทีม และทีมที่กำลังหาคน', [{ label: 'เปิดหน้าเพื่อนร่วมทีม', url: '/teams?src=line' }])])
  }

  // Free text → the same DeepSeek intent pipeline as the website.
  const { intent, usedFallback } = await parseIntent(text)
  const profile = await profileByLine(e.source.userId!)
  const results = await runSearch(intent, profile?.id ?? null)
  const searchUrl = `/search?q=${encodeURIComponent(text)}&src=line`
  await adminClient()
    .from('search_logs')
    .insert({
      user_id: profile?.id ?? null,
      query: text,
      parsed: intent,
      confidence: intent.confidence,
      used_fallback: usedFallback,
      source: 'line',
      result_counts: { events: results.events.length, teams: results.teams.length, people: results.people.length, cofounder: results.cofounders.length },
    })

  const summary = [
    intent.summary && `เข้าใจว่า: ${intent.summary}`,
    `เจอ งาน ${results.events.length} · ทีม ${results.teams.length} · คนหาทีม ${results.people.length} · co-founder ${results.cofounders.length}`,
  ]
    .filter(Boolean)
    .join('\n')
  const messages = [textMessage(summary, [{ label: 'ดูผลทั้งหมดบนเว็บ', url: searchUrl }, ...QUICK.slice(0, 1)])]
  if (results.events.length) {
    messages.push(
      eventsCarousel(
        'งานที่ตรงกับคุณ',
        results.events.slice(0, 5).map((r) => ({
          title: r.item.title,
          subtitle: `แนะนำเพราะ ${r.reason}`,
          imageUrl: r.item.poster_url,
          url: `/opportunities/${r.item.slug}${results.teams.length ? '#teams' : ''}`,
          badge: deadlineLine(r.item.deadline, r.item.open_note).split(' · ')[1],
        })),
        searchUrl,
      ),
    )
  } else {
    messages.push(
      noticeFlex({
        altText: 'ดูผลการค้นหาบนเว็บ',
        title: 'ดูทีมและคนที่ตรงกับคุณบนเว็บ',
        subtitle: results.focusEvent ? results.focusEvent.title : 'มีตัวกรองที่แก้ได้ และกดทักได้ทันที',
        actions: [{ type: 'uri', label: 'เปิดผลการค้นหา', url: searchUrl }],
      }),
    )
  }
  await replyMessage(e.replyToken, messages)
}

async function handle(e: LineEvent) {
  if (!e.source.userId) return
  try {
    if (e.type === 'follow') await onFollow(e)
    else if (e.type === 'unfollow') await onUnfollow(e)
    else if (e.type === 'postback') await onPostback(e)
    else if (e.type === 'message' && e.message?.type === 'text') await onText(e)
  } catch (err) {
    console.error('LINE webhook event failed', e.type, err)
  }
}

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyLineSignature(raw, request.headers.get('x-line-signature'))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const body = JSON.parse(raw) as { events: LineEvent[] }
  // Acknowledge immediately; reply tokens stay valid long enough for processing.
  after(async () => {
    await Promise.all((body.events || []).map(handle))
  })
  return NextResponse.json({ ok: true })
}
