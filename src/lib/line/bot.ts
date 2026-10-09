import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { listPublishedEvents } from '@/lib/data/events'
import { listSeekers, listTeams } from '@/lib/data/community'
import { isClosed, msLeft, thaiDeadline, timeLeftLabel, urgency } from '@/lib/format'
import { CATEGORIES, ROLE_KEYS, type Role } from '@/lib/constants'
import { TOPICS } from '@/lib/topics'
import { issueLinkToken, linkPageUrl } from './link'
import { WELCOME_IMAGE, absoluteUrl, eventsCarousel, noticeFlex, textMessage, type NoticeContent } from './messaging'
import type { EventRow } from '@/lib/types'

// What the OA chat answers. Every menu button is a postback ("m:<action>") answered with a
// reply — replies are free, so browsing in LINE never touches the monthly push quota — and
// every answer carries a link into the website (that's the point: bring people to the site).

type LineMessage = Record<string, unknown>
export type Linked = { id: string; first_name: string; onboarded: boolean; interests: string[]; notify_matches: boolean }

export const PROFILE_COLS = 'id, first_name, onboarded, interests, notify_matches'

export async function linkedProfile(lineUserId: string): Promise<Linked | null> {
  const { data } = await adminClient().from('profiles').select(PROFILE_COLS).eq('line_user_id', lineUserId).maybeSingle()
  return data as Linked | null
}

const web = (path: string) => `${path}${path.includes('?') ? '&' : '?'}src=line`

// No quick replies: the bottom menu already has every action, so replies stay clean.

// Interests use the same keys as the website profile ("สายที่สนใจ") and event tags.
export const INTEREST_LABEL: Record<Role, string> = {
  developer: '💻 เขียนโปรแกรม / เทค',
  data_ai: '🤖 AI / Data',
  ux_ui: '🎨 ออกแบบ UX/UI',
  business: '📈 ธุรกิจ / สตาร์ตอัพ',
  marketing: '📣 การตลาด / คอนเทนต์',
  hardware: '🔧 ฮาร์ดแวร์ / หุ่นยนต์',
  domain_expert: '🩺 การแพทย์ / สุขภาพ',
}

const TONE = { closed: 'grey', today: 'red', soon: 'red', week: 'orange', normal: 'blue', none: 'blue' } as const

function eventItem(ev: EventRow, reason?: string) {
  const ms = msLeft(ev)
  return {
    title: ev.title,
    category: CATEGORIES[ev.category],
    subtitle: reason ? `แนะนำเพราะ ${reason}` : ev.deadline ? `ปิดรับ ${thaiDeadline(ev)}` : ev.open_note || 'เปิดรับสมัครอยู่',
    imageUrl: ev.poster_url,
    url: web(`/opportunities/${ev.slug}`),
    badge: ev.is_club ? 'จากชมรม' : ms !== null ? timeLeftLabel(ms) : undefined,
    badgeTone: ev.is_club ? ('yellow' as const) : TONE[urgency(ev)],
  }
}

const byDeadline = (a: EventRow, b: EventRow) => (msLeft(a) ?? Infinity) - (msLeft(b) ?? Infinity)
const weekCount = (events: EventRow[]) => events.filter((e) => (msLeft(e) ?? Infinity) <= 7 * 86_400_000).length

/** Does an event fit these interests? Its tags, or the subject words of the matching topics. */
export function fitsInterests(e: EventRow, interests: string[]): string | null {
  const tag = e.tags.find((t) => interests.includes(t))
  if (tag) return INTEREST_LABEL[tag as Role]?.replace(/^\S+\s/, '') ?? null
  const text = `${e.title} ${e.summary ?? ''} ${(e.overview ?? '').slice(0, 2000)}`.toLowerCase()
  for (const t of TOPICS) {
    if (t.role && interests.includes(t.role) && t.match.some((w) => (/^[a-z]/.test(w) ? new RegExp(`(^|[^a-z])${w}`).test(text) : text.includes(w)))) return t.label
  }
  return null
}

// ------------------------------------------------------------------ cards

/**
 * Personal one-tap link (LINE account-link token). If LINE can't issue one right now, fall back
 * to the website's "เชื่อมต่อ LINE" page so the card still works.
 */
async function linkUrl(lineUserId: string): Promise<string> {
  try {
    return linkPageUrl(await issueLinkToken(lineUserId))
  } catch (err) {
    console.error('linkToken failed — using the website link page', err)
    return web('/me#line')
  }
}

export async function linkInvite(lineUserId: string, intro: string): Promise<LineMessage> {
  return noticeFlex({
    altText: 'เชื่อมบัญชีเว็บ Mahidol Startup Club กับ LINE',
    headerBar: 'สมัครสมาชิกฟรี',
    title: intro,
    subtitle: 'ใช้เวลาไม่ถึง 1 นาที — มีบัญชีอยู่แล้วก็เข้าสู่ระบบได้เลย (ลิงก์ใช้ได้ 10 นาที)',
    bullets: ['1️⃣  แตะ “สมัคร / เข้าสู่ระบบ”', '2️⃣  เลือก Google หรืออีเมล', '3️⃣  กดยืนยันกับ LINE — เสร็จ!'],
    quote: 'สมาชิกเลือกเรื่องที่สนใจได้ แล้วเราจะส่งงานที่ตรงกับคุณ คำชวนเข้าทีม และการเตือนก่อนปิดรับมาที่แชตนี้',
    actions: [
      { type: 'uri', label: 'สมัคร / เข้าสู่ระบบ', url: await linkUrl(lineUserId) },
      { type: 'postback', label: 'ดูงานที่เปิดรับก่อน', data: 'm:open', displayText: 'งานที่เปิดรับ' },
    ],
  })
}

/** Welcome — after adding the OA, after linking, or "เมนู". Linked users get the interest picker next. */
export async function welcome(lineUserId: string, profile: Linked | null, justLinked = false): Promise<LineMessage[]> {
  const base: Omit<NoticeContent, 'actions'> = {
    altText: 'ยินดีต้อนรับสู่ Mahidol Startup Club',
    imageUrl: WELCOME_IMAGE(),
    imageAspect: '52:27',
    title: profile
      ? `ยินดีต้อนรับสู่ Mahidol Startup Club${profile.first_name ? ` คุณ${profile.first_name}` : ''} 🎉`
      : 'ยินดีต้อนรับสู่ Mahidol Startup Club 👋',
    subtitle: justLinked ? 'เชื่อมบัญชีเว็บกับ LINE เรียบร้อยแล้ว ✓' : 'ชมรมสตาร์ตอัพมหิดล — งานแข่ง ทุน ทีม และ co-founder ในที่เดียว',
    bullets: ['🏆  งานแข่ง & ทุนใหม่ทุกวัน พร้อมนับถอยหลังวันปิดรับ', '⭐  งานที่ตรงกับความสนใจของคุณ สรุปให้ทุกสัปดาห์', '👥  หาทีม หรือชวนคนที่ใช่เข้าทีม'],
  }
  if (!profile) {
    return [
      noticeFlex({
        ...base,
        quote: 'สมัครสมาชิกฟรีบนเว็บ (ใช้ Google ได้ ไม่ถึง 1 นาที) แล้ว LINE นี้จะเชื่อมกับบัญชีให้อัตโนมัติ — เลือกเรื่องที่สนใจ รับงานที่ตรงกับคุณ และคำชวนเข้าทีมในแชตนี้',
        actions: [
          { type: 'uri', label: 'สมัครสมาชิกฟรี', url: await linkUrl(lineUserId) },
          { type: 'postback', label: 'ดูงานที่เปิดรับก่อน', data: 'm:open', displayText: 'งานที่เปิดรับ' },
          { type: 'uri', label: 'เปิดเว็บไซต์', url: web('/') },
        ],
      }),
      // Always followed by the menu card: LINE on iPad/Mac/PC doesn't show the rich menu.
      menuCard(null),
    ]
  }
  // Interests are picked on the website (/settings/interests) — one card here, no picker.
  return [
    noticeFlex({
      ...base,
      actions: [
        profile.interests.length
          ? { type: 'postback', label: 'ดูงานที่ตรงกับฉัน', data: 'm:foryou', displayText: 'งานที่ตรงกับฉัน' }
          : { type: 'uri', label: 'เลือกเรื่องที่สนใจ', url: web('/settings/interests') },
        profile.interests.length
          ? { type: 'uri', label: 'แก้เรื่องที่สนใจ', url: web('/settings/interests') }
          : { type: 'postback', label: 'ดูงานที่เปิดรับ', data: 'm:open', displayText: 'งานที่เปิดรับ' },
        { type: 'uri', label: 'เปิดเว็บไซต์', url: web('/') },
      ],
    }),
    menuCard(profile),
  ]
}

/**
 * The rich menu's 4 buttons as a message. LINE shows rich menus only in the phone apps (not on
 * LINE for PC/Mac, nor on an iPad that isn't the account's main device) — typing "เมนู" gives
 * everyone the same buttons.
 */
export function menuCard(p: Linked | null): LineMessage {
  return noticeFlex({
    altText: 'เมนู Mahidol Startup Club',
    headerBar: 'เมนู',
    title: 'อยากดูอะไรดี?',
    subtitle: 'แตะปุ่มด้านล่าง หรือพิมพ์สิ่งที่อยากทำได้เลย เช่น “หาทีมทำแอป”',
    actions: p
      ? [
          { type: 'postback', label: 'งานแข่ง & ทุน', data: 'm:open', displayText: 'งานแข่ง & ทุน' },
          { type: 'postback', label: 'ตรงกับฉัน', data: 'm:foryou', displayText: 'ตรงกับฉัน' },
          { type: 'postback', label: 'หาทีม', data: 'm:teams', displayText: 'หาทีม' },
          { type: 'uri', label: 'เปิดเว็บไซต์', url: web('/') },
        ]
      : [
          { type: 'postback', label: 'งานแข่ง & ทุน', data: 'm:open', displayText: 'งานแข่ง & ทุน' },
          { type: 'postback', label: 'หาทีม', data: 'm:teams', displayText: 'หาทีม' },
          { type: 'postback', label: 'สมัครสมาชิกฟรี', data: 'm:join', displayText: 'สมัครสมาชิก' },
          { type: 'uri', label: 'เปิดเว็บไซต์', url: web('/') },
        ],
  })
}

/** Interests and notification switch live on the website. */
export function interestsOnWeb(p: Linked, heading = 'เลือกเรื่องที่สนใจบนเว็บ'): LineMessage {
  const chosen = p.interests.map((r) => INTEREST_LABEL[r as Role]?.replace(/^\S+\s/, '')).filter(Boolean)
  return noticeFlex({
    altText: heading,
    headerBar: 'ความสนใจ',
    title: heading,
    subtitle: 'เลือกเรื่องที่สนใจ และเปิด/ปิดการแจ้งเตือนงานที่ตรงกับคุณ — ใช้เวลาไม่ถึงนาที',
    facts: [
      { label: 'ตอนนี้', value: chosen.length ? chosen.join(', ') : 'ยังไม่ได้เลือก' },
      { label: 'แจ้งเตือน', value: p.notify_matches ? 'เปิด (สรุปทุกสัปดาห์)' : 'ปิด' },
    ],
    actions: [{ type: 'uri', label: 'เลือกเรื่องที่สนใจ', url: web('/settings/interests') }],
  })
}

export function help(): LineMessage {
  const examples = ['หาทีมลง hackathon ฉันทำ UX ได้', 'ทุนสตาร์ตอัพที่ปิดรับเดือนนี้', 'งานแข่งด้านการแพทย์', 'อยากได้ co-founder สาย tech']
  return noticeFlex({
    altText: 'พิมพ์สิ่งที่อยากทำได้เลย',
    headerBar: 'วิธีค้นหา',
    title: 'พิมพ์สิ่งที่อยากทำเป็นประโยคได้เลย 💬',
    subtitle: 'บอกงานที่สนใจ สิ่งที่คุณทำได้ หรือคนที่ทีมขาด แล้วเราจะหางาน ทีม และคนที่ตรงที่สุดให้ — หรือแตะตัวอย่าง',
    actions: examples.map((t) => ({ type: 'message' as const, label: t.length > 20 ? `${t.slice(0, 18)}…` : t, text: t })),
  })
}

export async function account(lineUserId: string, p: Linked | null): Promise<LineMessage[]> {
  if (!p) return [await linkInvite(lineUserId, 'สมัครสมาชิก Mahidol Startup Club 🚀')]
  const chosen = p.interests.map((r) => INTEREST_LABEL[r as Role]?.replace(/^\S+\s/, '')).filter(Boolean)
  return [
    noticeFlex({
      altText: 'บัญชีของคุณ',
      headerBar: 'บัญชีของคุณ',
      badge: 'เชื่อมกับ LINE แล้ว ✓',
      badgeTone: 'blue',
      title: `สวัสดี${p.first_name ? ` คุณ${p.first_name}` : ''} 👋`,
      facts: [
        { label: 'สนใจ', value: chosen.length ? chosen.join(', ') : 'ยังไม่ได้เลือก' },
        { label: 'แจ้งเตือน', value: p.notify_matches ? 'สรุปงานที่ตรงกับคุณทุกสัปดาห์' : 'ปิดอยู่' },
      ],
      actions: [
        { type: 'uri', label: 'เลือกเรื่องที่สนใจ', url: web('/settings/interests') },
        { type: 'uri', label: 'บัญชีของฉันบนเว็บ', url: web('/me#line') },
        { type: 'uri', label: 'โปรไฟล์ & กล่องข้อความ', url: web('/me') },
      ],
    }),
  ]
}

export async function openEvents(closingSoon: boolean, p: Linked | null = null): Promise<LineMessage[]> {
  const week = 7 * 86_400_000
  const events = (await listPublishedEvents())
    .filter((ev) => !isClosed(ev) && (!closingSoon || (msLeft(ev) ?? Infinity) <= week))
    .sort(byDeadline)
  const more = closingSoon ? '/opportunities?within=7' : '/opportunities'
  if (!events.length) {
    return [
      noticeFlex({
        altText: 'ยังไม่มีงานที่เปิดรับ',
        title: closingSoon ? 'ไม่มีงานที่ปิดรับภายใน 7 วัน 🎉' : 'ตอนนี้ยังไม่มีงานที่เปิดรับ',
        subtitle: 'มีงานใหม่เมื่อไหร่ จะขึ้นที่นี่และบนเว็บทันที',
        actions: [{ type: 'uri', label: 'เปิดหน้างานแข่งบนเว็บ', url: web('/opportunities') }],
      }),
    ]
  }
  return [
    eventsCarousel(closingSoon ? 'งานที่ใกล้ปิดรับใน 7 วัน' : 'งานแข่ง & ทุนที่เปิดรับ', events.slice(0, 9).map((ev) => eventItem(ev)), web(more)),
    // Short summary under the carousel (no quick-reply buttons — the menu has them).
    textMessage(
      (closingSoon
        ? `⏰ ${events.length} งานปิดรับภายใน 7 วัน — เลื่อนดูได้เลย`
        : `🏆 เปิดรับอยู่ ${events.length} งาน เรียงตามวันปิดรับ — เลื่อนดู หรือแตะ “ดูทั้งหมดบนเว็บ”${weekCount(events) ? `\n⏰ ในนี้ ${weekCount(events)} งานปิดรับภายใน 7 วัน` : ''}`) +
        (p ? '' : '\n\n🚀 สมัครสมาชิกฟรี (พิมพ์ “สมัคร” หรือแตะในเมนู) เพื่อรับงานที่ตรงกับคุณและเตือนก่อนปิดรับ'),
    ),
  ]
}

export async function forYou(lineUserId: string, p: Linked | null): Promise<LineMessage[]> {
  if (!p) return [await linkInvite(lineUserId, 'สมัครสมาชิกฟรี เพื่อดูงานที่ตรงกับคุณ ⭐')]
  if (!p.interests.length) return [interestsOnWeb(p, 'เลือกเรื่องที่สนใจก่อน แล้วเราจะหางานที่ตรงให้')]
  const matches = (await listPublishedEvents())
    .filter((ev) => !isClosed(ev))
    .map((ev) => ({ ev, why: fitsInterests(ev, p.interests) }))
    .filter((x): x is { ev: EventRow; why: string } => Boolean(x.why))
    .sort((a, b) => byDeadline(a.ev, b.ev))
  if (!matches.length) {
    return [
      noticeFlex({
        altText: 'ยังไม่มีงานที่ตรงกับความสนใจ',
        title: 'ยังไม่มีงานที่ตรงกับความสนใจของคุณเปิดรับอยู่',
        subtitle: 'ลองเลือกเรื่องที่สนใจเพิ่ม หรือดูงานทั้งหมด',
        actions: [
          { type: 'postback', label: 'ดูงานที่เปิดรับทั้งหมด', data: 'm:open', displayText: 'งานแข่ง & ทุน' },
          { type: 'uri', label: 'เลือกเรื่องที่สนใจ', url: web('/settings/interests') },
        ],
      }),
    ]
  }
  return [
    eventsCarousel('งานที่ตรงกับคุณ', matches.slice(0, 9).map((m) => eventItem(m.ev, `ตรงกับ ${m.why}`)), web('/opportunities')),
    textMessage(`⭐ ${matches.length} งานตรงกับความสนใจของคุณ เรียงตามวันปิดรับ — แก้เรื่องที่สนใจได้ที่เว็บ: ${absoluteUrl(web('/settings/interests'))}`),
  ]
}

export async function teams(viewerId: string | null): Promise<LineMessage[]> {
  const [teamPosts, seekers] = await Promise.all([listTeams(viewerId, { limit: 50 }), listSeekers(viewerId, { limit: 50 })])
  return [
    noticeFlex({
      altText: 'หาทีม / หาคนเข้าทีม',
      headerBar: 'เพื่อนร่วมทีม',
      title: 'อยากหาทีม หรือหาคนเข้าทีม?',
      facts: [
        { label: 'ทีมที่หาคน', value: `${teamPosts.length} ทีม` },
        { label: 'คนที่หาทีม', value: `${seekers.length} คน` },
      ],
      subtitle: 'ดูทีมที่ขาดตำแหน่งที่คุณทำได้ หรือประกาศของคุณเองให้คนที่ใช่ทักมา',
      actions: [
        { type: 'uri', label: 'ดูทีม & คนหาทีม', url: web('/teams') },
        { type: 'uri', label: 'ประกาศหาทีม', url: web('/teams/new?as=member') },
        { type: 'uri', label: 'ชวนคนเข้าทีม', url: web('/teams/new') },
      ],
    }),
  ]
}

// ------------------------------------------------------------------ menu postbacks

export async function handleMenu(data: string, lineUserId: string): Promise<LineMessage[] | null> {
  if (!data.startsWith('m:')) return null
  const [, action, arg] = data.split(':')
  let p = await linkedProfile(lineUserId)
  switch (action) {
    case 'open':
      return openEvents(false, p)
    case 'closing':
      return openEvents(true, p)
    case 'join':
      return p
        ? [
            noticeFlex({
              altText: 'คุณเป็นสมาชิกแล้ว',
              headerBar: 'สมาชิก',
              badge: 'เชื่อมบัญชีแล้ว ✓',
              badgeTone: 'blue',
              title: `คุณเป็นสมาชิกอยู่แล้ว${p.first_name ? ` คุณ${p.first_name}` : ''} 🎉`,
              subtitle: 'ดูงานที่ตรงกับคุณ หรือเปิดเว็บเพื่อหาทีมได้เลย',
              actions: [
                { type: 'postback', label: 'ดูงานที่ตรงกับฉัน', data: 'm:foryou', displayText: 'งานที่ตรงกับฉัน' },
                { type: 'uri', label: 'เปิดเว็บไซต์', url: web('/') },
              ],
            }),
          ]
        : [await linkInvite(lineUserId, 'สมัครสมาชิก Mahidol Startup Club ฟรี 🚀'), textMessage('ยังไม่พร้อมสมัคร? พิมพ์ “งานแข่ง” หรือแตะ “งานแข่ง & ทุน” ในเมนู ดูงานก่อนได้เลย 👇')]
    case 'foryou':
      return forYou(lineUserId, p)
    case 'teams':
      return teams(p?.id ?? null)
    case 'help':
      return [help()]
    case 'account':
      return account(lineUserId, p)
    case 'welcome':
      return welcome(lineUserId, p)
    case 'menu':
      return [menuCard(p)]
    case 'interests':
    case 't': // buttons on older in-chat pickers
    case 'n':
      return p ? [interestsOnWeb(p)] : [await linkInvite(lineUserId, 'สมัครสมาชิกฟรี เพื่อเลือกเรื่องที่สนใจ 🎯')]
    default:
      return [menuCard(p)]
  }
}
