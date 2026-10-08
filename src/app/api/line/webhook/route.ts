import { NextResponse, after } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { verifyPayload } from '@/lib/crypto'
import { WELCOME_IMAGE, eventsCarousel, noticeFlex, replyMessage, textMessage, verifyLineSignature, type NoticeContent } from '@/lib/line/messaging'
import { LINK_CODE_RE, consumeLinkCode, consumeNonce, issueLinkToken, linkPageUrl } from '@/lib/line/link'
import { parseIntent } from '@/lib/ai/intent'
import { runSearch } from '@/lib/search'
import { respondToRequest } from '@/lib/messaging'
import { listPublishedEvents } from '@/lib/data/events'
import { deadlineLine, isClosed, thaiDeadline, timeLeftLabel, msLeft, urgency } from '@/lib/format'
import type { EventRow } from '@/lib/types'
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
  { label: '🏆 งานแข่งที่เปิดอยู่', text: 'งานแข่ง' },
  { label: '⏰ ใกล้ปิดรับ', text: 'ใกล้ปิดรับ' },
  { label: '👥 หาทีม', text: 'หาทีม' },
  { label: '💡 วิธีค้นหา', text: 'วิธีค้นหา' },
  { label: '🔔 ตั้งค่าแจ้งเตือน', text: 'ตั้งค่าแจ้งเตือน' },
]
const EXAMPLES = ['หาทีมลง hackathon ฉันทำ UX ได้', 'ทุนสตาร์ตอัพที่ปิดรับเดือนนี้', 'งานแข่งด้านการแพทย์', 'อยากได้ co-founder สาย tech']
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
    headerBar: 'เชื่อมบัญชี',
    title: intro,
    subtitle: 'ใช้เวลาไม่ถึง 1 นาที (ลิงก์ใช้ได้ 10 นาที)',
    bullets: ['1️⃣  แตะ “เชื่อมบัญชีเลย”', '2️⃣  สมัครหรือเข้าสู่ระบบ (Google / อีเมล)', '3️⃣  กดยืนยันกับ LINE — เสร็จ!'],
    quote: 'หลังเชื่อมแล้ว คำชวนเข้าทีม งานแข่งที่ตรงกับคุณ และการเตือนก่อนปิดรับ จะส่งมาที่แชตนี้',
    actions: [
      { type: 'uri', label: 'เชื่อมบัญชีเลย', url: linkPageUrl(linkToken) },
      { type: 'message', label: 'ดูงานแข่งก่อน', text: 'งานแข่ง' },
    ],
  })
}

function linkedDone(p: Linked) {
  return noticeFlex({
    altText: 'เชื่อมบัญชีสำเร็จ',
    headerBar: 'สำเร็จ 🎉',
    badge: 'เชื่อมบัญชีแล้ว',
    badgeTone: 'blue',
    title: `บัญชีเว็บของ${p.first_name ? ` ${p.first_name}` : 'คุณ'}เชื่อมกับ LINE นี้แล้ว`,
    subtitle: p.onboarded
      ? 'ข่าวสารและแจ้งเตือนจากเว็บจะส่งมาที่แชตนี้ เลือกเรื่องที่อยากรู้ได้ในหน้าตั้งค่า'
      : 'ข่าวสารจะส่งมาที่แชตนี้ — กรอกโปรไฟล์ต่ออีกนิด เพื่อให้เราแนะนำงานแข่งและทีมที่ตรงกับคุณ',
    actions: [
      p.onboarded
        ? { type: 'uri', label: 'ตั้งค่าแจ้งเตือน', url: '/settings/notifications?src=line' }
        : { type: 'uri', label: 'กรอกโปรไฟล์ต่อ', url: '/onboarding?src=line' },
      { type: 'message', label: 'ดูงานแข่งที่เปิดอยู่', text: 'งานแข่ง' },
      { type: 'message', label: 'วิธีค้นหา', text: 'วิธีค้นหา' },
    ],
  })
}

/** First card after adding the OA (also "เมนู"/"สวัสดี"). */
async function welcomeCard(uid: string, profile: Linked | null) {
  const base: Omit<NoticeContent, 'actions'> = {
    altText: 'ยินดีต้อนรับสู่ Mahidol Startup Club',
    imageUrl: WELCOME_IMAGE(),
    imageAspect: '52:27',
    title: profile ? `ยินดีต้อนรับกลับ${profile.first_name ? ` ${profile.first_name}` : ''} 👋` : 'ยินดีต้อนรับสู่ Mahidol Startup Club 👋',
    subtitle: 'ชมรมสตาร์ตอัพมหิดล — ที่รวมงานแข่ง ทุน ทีม และ co-founder',
    bullets: ['🏆  งานแข่ง & ทุน อัปเดตทุกวัน พร้อมเตือนก่อนปิดรับ', '👥  หาทีม หรือชวนคนที่ใช่เข้าทีม', '💬  พิมพ์สิ่งที่อยากทำในแชตนี้ได้เลย เราหาให้'],
  }
  if (profile) {
    return noticeFlex({
      ...base,
      actions: [
        { type: 'message', label: 'ดูงานแข่งที่เปิดอยู่', text: 'งานแข่ง' },
        { type: 'message', label: 'วิธีค้นหา', text: 'วิธีค้นหา' },
        { type: 'uri', label: 'ตั้งค่าแจ้งเตือน', url: '/settings/notifications?src=line' },
      ],
    })
  }
  const linkToken = await issueLinkToken(uid)
  return noticeFlex({
    ...base,
    quote: 'เชื่อมบัญชีเว็บกับ LINE เพื่อรับคำชวนเข้าทีมและงานที่ตรงกับคุณที่นี่',
    actions: [
      { type: 'uri', label: 'เชื่อมบัญชีเว็บ', url: linkPageUrl(linkToken) },
      { type: 'message', label: 'ดูงานแข่งที่เปิดอยู่', text: 'งานแข่ง' },
      { type: 'message', label: 'วิธีค้นหา', text: 'วิธีค้นหา' },
    ],
  })
}

/** "วิธีค้นหา" — examples the user can tap. */
function helpCard() {
  return noticeFlex({
    altText: 'พิมพ์สิ่งที่อยากทำได้เลย',
    headerBar: 'วิธีค้นหา',
    title: 'พิมพ์สิ่งที่อยากทำเป็นประโยคได้เลย 💬',
    subtitle: 'บอกงานที่สนใจ สิ่งที่คุณทำได้ หรือคนที่ทีมขาด แล้วเราจะหางาน ทีม และคนที่ตรงที่สุดให้ — หรือแตะตัวอย่างด้านล่าง',
    actions: EXAMPLES.map((t) => ({ type: 'message' as const, label: t.length > 20 ? `${t.slice(0, 18)}…` : t, text: t })),
  })
}

function teamsCard() {
  return noticeFlex({
    altText: 'หาทีม / หาคนเข้าทีม',
    headerBar: 'เพื่อนร่วมทีม',
    title: 'อยากหาทีม หรือหาคนเข้าทีม?',
    subtitle: 'ดูคนที่กำลังหาทีม และทีมที่ขาดตำแหน่งที่คุณทำได้ — หรือประกาศของคุณเองให้คนที่ใช่ทักมา',
    actions: [
      { type: 'uri', label: 'ดูทีม & คนหาทีม', url: '/teams?src=line' },
      { type: 'uri', label: 'ประกาศหาทีม', url: '/teams/looking/new?src=line' },
      { type: 'uri', label: 'ชวนคนเข้าทีม', url: '/teams/new?src=line' },
    ],
  })
}

const TONE = { closed: 'grey', today: 'red', soon: 'red', week: 'orange', normal: 'blue', none: 'blue' } as const

function eventItem(ev: EventRow, reason?: string) {
  const ms = msLeft(ev)
  return {
    title: ev.title,
    category: CATEGORIES[ev.category],
    subtitle: reason ? `แนะนำเพราะ ${reason}` : ev.deadline ? `ปิดรับ ${thaiDeadline(ev)}` : ev.open_note || 'เปิดรับสมัครอยู่',
    imageUrl: ev.poster_url,
    url: `/opportunities/${ev.slug}?src=line`,
    badge: ev.is_club ? 'จากชมรม' : ms !== null ? timeLeftLabel(ms) : undefined,
    badgeTone: ev.is_club ? ('yellow' as const) : TONE[urgency(ev)],
  }
}

async function onFollow(e: LineEvent) {
  const uid = e.source.userId!
  let profile = await linkedProfile(uid)
  // Added as a friend from the LINE Login consent screen: the follow event arrives a moment
  // before the website finishes linking — wait briefly so we greet them as linked.
  if (!profile) {
    await new Promise((r) => setTimeout(r, 4000))
    profile = await linkedProfile(uid)
  }
  if (profile) await adminClient().from('profiles').update({ line_is_friend: true }).eq('id', profile.id)
  if (!e.replyToken) return
  await replyMessage(e.replyToken, [await welcomeCard(uid, profile), textMessage('แตะเมนูด้านล่าง หรือพิมพ์สิ่งที่อยากทำได้เลย 👇', QUICK)])
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

async function replyOpenEvents(replyToken: string, closingSoon = false) {
  const week = 7 * 86_400_000
  const events = (await listPublishedEvents())
    .filter((ev) => !isClosed(ev) && (!closingSoon || ((msLeft(ev) ?? Infinity) <= week)))
    .sort((a, b) => (msLeft(a) ?? Infinity) - (msLeft(b) ?? Infinity))
    .slice(0, 8)
  if (!events.length) {
    await replyMessage(replyToken, [textMessage(closingSoon ? 'ไม่มีงานที่ปิดรับภายใน 7 วัน 🎉 ดูงานทั้งหมดได้เลย' : 'ตอนนี้ยังไม่มีงานที่เปิดรับ — เราจะแจ้งทันทีที่มีงานใหม่', QUICK)])
    return
  }
  await replyMessage(replyToken, [
    eventsCarousel(closingSoon ? 'งานที่ใกล้ปิดรับใน 7 วัน' : 'งานแข่ง & ทุนที่เปิดรับอยู่', events.map((ev) => eventItem(ev)), closingSoon ? '/opportunities?within=7&src=line' : '/opportunities?src=line'),
    textMessage(closingSoon ? `⏰ ${events.length} งานใกล้ปิดรับ — เลื่อนดูได้เลย` : `🏆 งานที่เปิดรับ เรียงตามวันปิดรับ — เลื่อนดูได้เลย`, QUICK),
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
        noticeFlex({
          altText: 'บัญชีและการแจ้งเตือน',
          headerBar: 'บัญชีของคุณ',
          badge: 'เชื่อมกับ LINE แล้ว ✓',
          badgeTone: 'blue',
          title: `สวัสดี${profile.first_name ? ` ${profile.first_name}` : ''} 👋`,
          subtitle: 'เลือกเรื่องที่อยากให้แจ้งเตือนผ่าน LINE หรือแก้ไขโปรไฟล์เพื่อให้เราแนะนำงานและทีมได้ตรงขึ้น',
          actions: [
            { type: 'uri', label: 'ตั้งค่าแจ้งเตือน', url: '/settings/notifications?src=line' },
            { type: 'uri', label: 'โปรไฟล์ของฉัน', url: '/me?src=line' },
            { type: 'uri', label: 'กล่องข้อความ', url: '/inbox?src=line' },
          ],
        }),
      ])
    }
    return replyMessage(e.replyToken, [await linkInvite(uid, 'เชื่อมบัญชีเว็บกับ LINE นี้')])
  }
  if (/^(งานแข่ง|ทุน|งาน|events?|งานแข่งที่เปิดอยู่)$/i.test(text)) return replyOpenEvents(e.replyToken)
  if (/^(ใกล้ปิด|ใกล้ปิดรับ|ปิดเร็วๆนี้)$/i.test(text)) return replyOpenEvents(e.replyToken, true)
  if (/^(ทีม|หาทีม|เพื่อนร่วมทีม)$/i.test(text)) return replyMessage(e.replyToken, [teamsCard()])
  if (/^(วิธีค้นหา|วิธีใช้|ช่วยเหลือ|help|\?)$/i.test(text)) return replyMessage(e.replyToken, [helpCard(), textMessage('หรือเลือกจากเมนูด้านล่าง 👇', QUICK)])
  if (/^(เมนู|menu|สวัสดี.*|หวัดดี.*|hi|hello|start)$/i.test(text)) return replyMessage(e.replyToken, [await welcomeCard(uid, profile), textMessage('เลือกได้เลย 👇', QUICK)])

  // Free text → the same search pipeline as the website.
  const parsed = await parseIntent(text, profile?.id ?? uid)
  const { intent, usedFallback } = parsed
  if (parsed.status !== 'ok') {
    await adminClient().from('search_logs').insert({ user_id: profile?.id ?? null, query: text.slice(0, 300), used_fallback: false, source: 'line', engine: parsed.engine, status: parsed.status })
    return replyMessage(e.replyToken, [textMessage(parsed.message ?? '', QUICK), helpCard()])
  }
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
      engine: parsed.engine,
      status: parsed.status,
      result_counts: { events: results.events.length, teams: results.teams.length, people: results.people.length, cofounder: results.cofounders.length },
    })

  const counts = [
    `งาน ${results.events.length}`,
    `ทีม ${results.teams.length}`,
    `คนหาทีม ${results.people.length}`,
    `co-founder ${results.cofounders.length}`,
  ].join(' · ')
  const messages = [
    noticeFlex({
      altText: `ผลการค้นหา: ${intent.summary || text}`,
      headerBar: 'ผลการค้นหา',
      title: intent.summary || text,
      subtitle: `เจอ ${counts}`,
      actions: [
        { type: 'uri', label: 'ดูผลทั้งหมดบนเว็บ', url: searchUrl },
        ...(results.teams.length || results.people.length ? [{ type: 'uri' as const, label: 'ดูทีม & คน', url: `${searchUrl}&tab=${results.teams.length ? 'teams' : 'people'}` }] : []),
        ...(profile ? [] : [{ type: 'message' as const, label: 'เชื่อมบัญชีเว็บ', text: 'เชื่อมบัญชี' }]),
      ],
    }),
  ]
  if (results.events.length) {
    messages.push(eventsCarousel('งานที่ตรงกับคุณ', results.events.slice(0, 6).map((r) => eventItem(r.item, r.reason)), searchUrl))
  }
  messages.push(textMessage('ค้นอย่างอื่นได้เลย หรือเลือกจากเมนู 👇', QUICK))
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
