import { NextResponse, after } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { verifyPayload } from '@/lib/crypto'
import { eventsCarousel, noticeFlex, replyMessage, textMessage, verifyLineSignature } from '@/lib/line/messaging'
import { LINK_CODE_RE, consumeLinkCode, consumeNonce } from '@/lib/line/link'
import { handleMenu, linkInvite, linkedProfile, welcome } from '@/lib/line/bot'
import { parseIntent } from '@/lib/ai/intent'
import { runSearch } from '@/lib/search'
import { respondToRequest } from '@/lib/messaging'
import { msLeft, thaiDeadline, timeLeftLabel, urgency } from '@/lib/format'
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
type Msg = Record<string, unknown>

// Typed words that mean a menu button.
const COMMANDS: [RegExp, string][] = [
  [/^(งานแข่ง|ทุน|งาน|events?|งานที่เปิดรับ|งานแข่งที่เปิดอยู่)$/i, 'm:open'],
  [/^(ใกล้ปิด|ใกล้ปิดรับ|ปิดเร็วๆนี้|ด่วน)$/i, 'm:closing'],
  [/^(ตรงกับฉัน|งานที่ตรงกับฉัน|for you|แนะนำ)$/i, 'm:foryou'],
  [/^(ทีม|หาทีม|เพื่อนร่วมทีม)$/i, 'm:teams'],
  [/^(วิธีค้นหา|วิธีใช้|ช่วยเหลือ|help|\?)$/i, 'm:help'],
  [/^(ความสนใจ|เลือกความสนใจ|เลือกเรื่องที่สนใจ|สนใจ)$/i, 'm:interests'],
  [/^(เชื่อมบัญชี|เชื่อม line|ผูกบัญชี|บัญชี|ตั้งค่า|ตั้งค่าแจ้งเตือน|แจ้งเตือน|settings?)$/i, 'm:account'],
  [/^(เมนู|menu|เมนูหลัก|ปุ่ม)$/i, 'm:menu'],
  [/^(สมัคร|สมัครสมาชิก|join|sign ?up)$/i, 'm:join'],
  [/^(start|เริ่ม|สวัสดี.*|หวัดดี.*|hi|hello)$/i, 'm:welcome'],
]

const TONE = { closed: 'grey', today: 'red', soon: 'red', week: 'orange', normal: 'blue', none: 'blue' } as const

async function onFollow(e: LineEvent): Promise<Msg[]> {
  const uid = e.source.userId!
  let profile = await linkedProfile(uid)
  // Added as a friend on the LINE Login consent screen: the follow event arrives a moment
  // before the website finishes linking — wait briefly so we greet them as linked.
  if (!profile) {
    await new Promise((r) => setTimeout(r, 4000))
    profile = await linkedProfile(uid)
  }
  if (profile) await adminClient().from('profiles').update({ line_is_friend: true }).eq('id', profile.id)
  return welcome(uid, profile, Boolean(profile))
}

async function onUnfollow(e: LineEvent) {
  const profile = await linkedProfile(e.source.userId!)
  if (profile) await adminClient().from('profiles').update({ line_is_friend: false }).eq('id', profile.id)
}

/** LINE account-link result (after the user confirmed on access.line.me/dialog/bot/accountLink). */
async function onAccountLink(e: LineEvent): Promise<Msg[]> {
  const uid = e.source.userId!
  if (e.link?.result === 'ok' && e.link.nonce) {
    const userId = await consumeNonce(e.link.nonce, uid)
    const profile = userId ? await linkedProfile(uid) : null
    return profile ? welcome(uid, profile, true) : [await linkInvite(uid, 'ลิงก์หมดอายุ — แตะเพื่อเชื่อมบัญชีอีกครั้ง')]
  }
  return [await linkInvite(uid, 'เชื่อมบัญชีไม่สำเร็จ — ลองอีกครั้งได้เลย')]
}

async function onPostback(e: LineEvent): Promise<Msg[]> {
  const raw = e.postback?.data || ''
  const menu = await handleMenu(raw, e.source.userId!)
  if (menu) return menu
  // Signed accept/decline buttons on "invited to a team" notices.
  const data = verifyPayload<{ a: string; c: string; u: string }>(raw)
  if (!data || (data.a !== 'accept' && data.a !== 'decline')) return []
  const profile = await linkedProfile(e.source.userId!)
  if (!profile || profile.id !== data.u) {
    return [noticeFlex({ altText: 'เปิดบนเว็บแทน', title: 'ปุ่มนี้ใช้ได้เฉพาะบัญชีที่ได้รับคำขอ', subtitle: 'เปิดกล่องข้อความบนเว็บแทนได้เลย', actions: [{ type: 'uri', label: 'เปิดกล่องข้อความ', url: '/inbox?src=line' }] })]
  }
  try {
    const result = await respondToRequest(data.c, profile.id, data.a === 'accept')
    return [noticeFlex({ altText: result, title: `${result} ✓`, subtitle: data.a === 'accept' ? 'เริ่มคุยต่อบนเว็บได้เลย' : undefined, actions: [{ type: 'uri', label: 'เปิดแชต', url: `/inbox?c=${data.c}&src=line` }] })]
  } catch (err) {
    return [textMessage((err as Error).message)]
  }
}

async function onText(e: LineEvent): Promise<Msg[]> {
  const uid = e.source.userId!
  const text = (e.message?.text || '').trim()
  if (!text) return []

  // "เชื่อมบัญชี ABC123" — code shown on the website's "เชื่อมต่อ LINE" screen
  const code = text.match(LINK_CODE_RE)?.[1]
  if (code) {
    const userId = await consumeLinkCode(code, uid)
    const profile = userId ? await linkedProfile(uid) : null
    return profile
      ? welcome(uid, profile, true)
      : [await linkInvite(uid, 'รหัสนี้หมดอายุหรือถูกใช้ไปแล้ว — เชื่อมใหม่ได้ที่นี่')]
  }
  for (const [re, action] of COMMANDS) if (re.test(text)) return (await handleMenu(action, uid)) ?? []

  // Free text → the same search pipeline as the website.
  const profile = await linkedProfile(uid)
  const parsed = await parseIntent(text, profile?.id ?? uid)
  const { intent, usedFallback } = parsed
  if (parsed.status !== 'ok') {
    await adminClient().from('search_logs').insert({ user_id: profile?.id ?? null, query: text.slice(0, 300), used_fallback: false, source: 'line', engine: parsed.engine, status: parsed.status })
    return [textMessage(parsed.message ?? '')]
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

  const messages: Msg[] = [
    noticeFlex({
      altText: `ผลการค้นหา: ${intent.summary || text}`,
      headerBar: 'ผลการค้นหา',
      title: intent.summary || text,
      subtitle: `เจอ งาน ${results.events.length} · ทีม ${results.teams.length} · คนหาทีม ${results.people.length} · co-founder ${results.cofounders.length}`,
      actions: [
        { type: 'uri', label: 'ดูผลทั้งหมดบนเว็บ', url: searchUrl },
        ...(results.teams.length || results.people.length ? [{ type: 'uri' as const, label: 'ดูทีม & คน', url: `${searchUrl}&tab=${results.teams.length ? 'teams' : 'people'}` }] : []),
        ...(profile ? [] : [{ type: 'postback' as const, label: 'เชื่อมบัญชีเว็บ', data: 'm:account', displayText: 'เชื่อมบัญชี' }]),
      ],
    }),
  ]
  if (results.events.length) {
    messages.push(
      eventsCarousel(
        'งานที่ตรงกับคุณ',
        results.events.slice(0, 9).map((r) => {
          const ms = msLeft(r.item)
          return {
            title: r.item.title,
            category: CATEGORIES[r.item.category],
            subtitle: `แนะนำเพราะ ${r.reason}`,
            imageUrl: r.item.poster_url,
            url: `/opportunities/${r.item.slug}?src=line`,
            badge: r.item.deadline ? (ms !== null ? timeLeftLabel(ms) : thaiDeadline(r.item)) : undefined,
            badgeTone: TONE[urgency(r.item)],
          }
        }),
        searchUrl,
      ),
    )
  }
  messages.push(textMessage(profile ? 'พิมพ์ค้นอย่างอื่นได้เลย หรือพิมพ์ “เมนู” เพื่อดูปุ่มทั้งหมด 👇' : 'สมัครสมาชิกฟรี (พิมพ์ “สมัคร”) เพื่อรับงานที่ตรงกับคุณในแชตนี้ 👇'))
  return messages
}

async function answer(e: LineEvent): Promise<Msg[]> {
  if (e.type === 'follow') return onFollow(e)
  if (e.type === 'unfollow') return (await onUnfollow(e), [])
  if (e.type === 'accountLink') return onAccountLink(e)
  if (e.type === 'postback') return onPostback(e)
  if (e.type === 'message' && e.message?.type === 'text') return onText(e)
  return []
}

async function handle(e: LineEvent) {
  if (!e.source.userId) return
  try {
    const messages = await answer(e)
    if (messages.length && e.replyToken) await replyMessage(e.replyToken, messages)
  } catch (err) {
    console.error('LINE webhook event failed', e.type, e.postback?.data ?? e.message?.text?.slice(0, 40), err)
    // Never leave a tap unanswered.
    if (e.replyToken) {
      await replyMessage(e.replyToken, [
        textMessage('ขออภัย ระบบขัดข้องชั่วคราว ลองอีกครั้ง หรือเปิดดูบนเว็บ: https://mahidolstartup.site'),
      ]).catch(() => {})
    }
  }
}

/** Dry run (signed requests only): build the replies and let LINE validate them — nothing is sent. */
async function dryRun(events: LineEvent[]) {
  const token = process.env.LINE_MESSAGING_ACCESS_TOKEN
  const out = []
  for (const e of events) {
    const label = e.postback?.data ?? e.message?.text ?? e.type
    try {
      // Skip the follow event's 4 s wait and DB writes: render the same welcome as "เมนู".
      const probe = e.type === 'follow' ? { ...e, type: 'message', message: { type: 'text', text: 'เมนู' } } : e
      const messages = (await answer(probe)).slice(0, 5)
      const res = await fetch('https://api.line.me/v2/bot/message/validate/reply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
      out.push({ event: label, messages: messages.length, valid: res.ok, ...(res.ok ? {} : { error: (await res.text()).slice(0, 300) }) })
    } catch (err) {
      out.push({ event: label, valid: false, error: String(err).slice(0, 300) })
    }
  }
  return out
}

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyLineSignature(raw, request.headers.get('x-line-signature'))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const body = JSON.parse(raw) as { events: LineEvent[] }
  if (request.headers.get('x-msc-dryrun') === '1') return NextResponse.json({ results: await dryRun(body.events || []) })
  // Acknowledge immediately; reply tokens stay valid long enough for processing.
  after(async () => {
    await Promise.all((body.events || []).map(handle))
  })
  return NextResponse.json({ ok: true })
}
