import { NextResponse, after } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { verifyPayload } from '@/lib/crypto'
import { eventsCarousel, noticeFlex, replyMessage, textMessage, verifyLineSignature } from '@/lib/line/messaging'
import { LINK_CODE_RE, consumeLinkCode, consumeNonce, issueLinkToken, linkPageUrl } from '@/lib/line/link'
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
  link?: { result: 'ok' | 'failed'; nonce: string }
}

type Linked = { id: string; first_name: string; onboarded: boolean }

const QUICK = [
  { label: 'งานแข่งที่เปิดอยู่', text: 'งานแข่ง' },
  { label: 'หาทีม', url: '/teams?src=line' },
  { label: 'ตั้งค่าแจ้งเตือน', text: 'ตั้งค่าแจ้งเตือน' },
]
const LINK_QUICK = { label: 'เชื่อมบัญชีเว็บ', text: 'เชื่อมบัญชี' }

async function linkedProfile(lineUserId: string): Promise<Linked | null> {
  const { data } = await adminClient().from('profiles').select('id, first_name, onboarded').eq('line_user_id', lineUserId).maybeSingle()
  return data
}

/** Personal link for an unlinked LINE user: website → email sign-up/in → LINE account-link dialog. */
async function linkInvite(lineUserId: string, intro: string) {
  const linkToken = await issueLinkToken(lineUserId)
  return noticeFlex({
    altText: 'เชื่อมบัญชีเว็บ Mahidol Startup Club กับ LINE',
    headerBar: 'เชื่อมบัญชีกับเว็บ',
    title: intro,
    subtitle: 'แตะปุ่ม → สมัครหรือเข้าสู่ระบบด้วยอีเมล → ยืนยันกับ LINE เท่านี้ข่าวสาร คำชวนเข้าทีม และงานแข่งที่ตรงกับคุณจะส่งมาที่แชตนี้ (ลิงก์ใช้ได้ 10 นาที)',
    actions: [
      { type: 'uri', label: 'เชื่อมบัญชี', url: linkPageUrl(linkToken) },
      { type: 'uri', label: 'ดูงานแข่ง', url: '/opportunities?src=line' },
    ],
  })
}

function linkedDone(p: Linked) {
  return noticeFlex({
    altText: 'เชื่อมบัญชีสำเร็จ',
    headerBar: 'เชื่อมบัญชีสำเร็จ 🎉',
    title: `บัญชีเว็บของ${p.first_name ? ` ${p.first_name}` : 'คุณ'}เชื่อมกับ LINE นี้แล้ว`,
    subtitle: p.onboarded
      ? 'ข่าวสารและแจ้งเตือนจากเว็บจะส่งมาที่แชตนี้ เลือกเรื่องที่อยากรู้ได้ในหน้าตั้งค่า'
      : 'ข่าวสารจะส่งมาที่แชตนี้ — กรอกโปรไฟล์ต่ออีกนิด เพื่อให้เราแนะนำงานแข่งและทีมที่ตรงกับคุณ',
    actions: [
      p.onboarded
        ? { type: 'uri', label: 'ตั้งค่าแจ้งเตือน', url: '/settings/notifications?src=line' }
        : { type: 'uri', label: 'กรอกโปรไฟล์ต่อ', url: '/onboarding?src=line' },
    ],
  })
}

async function onFollow(e: LineEvent) {
  const uid = e.source.userId!
  const profile = await linkedProfile(uid)
  if (profile) await adminClient().from('profiles').update({ line_is_friend: true }).eq('id', profile.id)
  if (!e.replyToken) return
  if (profile) {
    await replyMessage(e.replyToken, [
      textMessage(
        `ยินดีต้อนรับกลับ ${profile.first_name || ''} 🎉\nบัญชีเว็บของคุณเชื่อมกับ LINE นี้อยู่แล้ว\n\nลองพิมพ์สิ่งที่อยากทำได้เลย เช่น “หาทีมลง TED Youth ฉันทำ UX ได้”`,
        QUICK,
      ),
    ])
  } else {
    await replyMessage(e.replyToken, [await linkInvite(uid, 'ยินดีต้อนรับสู่ Mahidol Startup Club 👋 เชื่อมบัญชีเว็บเพื่อรับข่าวสารผ่าน LINE')])
  }
}

async function onUnfollow(e: LineEvent) {
  const profile = await linkedProfile(e.source.userId!)
  if (profile) await adminClient().from('profiles').update({ line_is_friend: false }).eq('id', profile.id)
}

/** LINE account-link result (after the user confirmed on access.line.me/dialog/bot/accountLink). */
async function onAccountLink(e: LineEvent) {
  const uid = e.source.userId!
  if (e.link?.result === 'ok' && e.link.nonce) {
    const userId = await consumeNonce(e.link.nonce, uid)
    const profile = userId ? await linkedProfile(uid) : null
    if (e.replyToken) {
      await replyMessage(e.replyToken, [profile ? linkedDone(profile) : await linkInvite(uid, 'ลิงก์หมดอายุ — แตะเพื่อเชื่อมบัญชีอีกครั้ง')])
    }
  } else if (e.replyToken) {
    await replyMessage(e.replyToken, [await linkInvite(uid, 'เชื่อมบัญชีไม่สำเร็จ — ลองอีกครั้งได้เลย')])
  }
}

async function onPostback(e: LineEvent) {
  const data = verifyPayload<{ a: string; c: string; u: string }>(e.postback?.data)
  if (!data || !e.replyToken) return
  const profile = await linkedProfile(e.source.userId!)
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
  const uid = e.source.userId!
  const text = (e.message?.text || '').trim()
  if (!e.replyToken || !text) return

  // "เชื่อมบัญชี ABC123" — code shown on the website's "เชื่อมต่อ LINE" screen
  const code = text.match(LINK_CODE_RE)?.[1]
  if (code) {
    const userId = await consumeLinkCode(code, uid)
    const profile = userId ? await linkedProfile(uid) : null
    await replyMessage(e.replyToken, [
      profile ? linkedDone(profile) : textMessage('รหัสนี้หมดอายุหรือถูกใช้ไปแล้ว — กลับไปที่หน้าเว็บเพื่อรับรหัสใหม่ หรือแตะ “เชื่อมบัญชีเว็บ”', [LINK_QUICK]),
    ])
    return
  }

  const profile = await linkedProfile(uid)
  if (/^(เชื่อมบัญชี|เชื่อม line|ผูกบัญชี|ตั้งค่า|ตั้งค่าแจ้งเตือน|แจ้งเตือน|settings?)$/i.test(text)) {
    if (profile) {
      return replyMessage(e.replyToken, [
        textMessage('บัญชีนี้เชื่อมกับเว็บแล้ว ✓ ตั้งค่าเรื่องที่อยากรับแจ้งเตือนได้ที่นี่', [{ label: 'ตั้งค่าแจ้งเตือน', url: '/settings/notifications?src=line' }]),
      ])
    }
    return replyMessage(e.replyToken, [await linkInvite(uid, 'เชื่อมบัญชีเว็บกับ LINE นี้')])
  }
  if (/^(งานแข่ง|ทุน|งาน|events?)$/i.test(text)) return replyOpenEvents(e.replyToken)
  if (/^(ทีม|หาทีม|เพื่อนร่วมทีม)$/i.test(text)) {
    return replyMessage(e.replyToken, [textMessage('ดูคนที่กำลังหาทีม และทีมที่กำลังหาคน', [{ label: 'เปิดหน้าเพื่อนร่วมทีม', url: '/teams?src=line' }])])
  }

  // Free text → the same DeepSeek intent pipeline as the website.
  const { intent, usedFallback } = await parseIntent(text)
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
  const quick = [{ label: 'ดูผลทั้งหมดบนเว็บ', url: searchUrl }, profile ? QUICK[0] : LINK_QUICK]
  const messages = [textMessage(summary, quick)]
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
    else if (e.type === 'accountLink') await onAccountLink(e)
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
