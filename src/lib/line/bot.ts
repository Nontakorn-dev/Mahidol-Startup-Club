import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { listPublishedEvents } from '@/lib/data/events'
import { listSeekers, listTeams } from '@/lib/data/community'
import { isClosed, msLeft, thaiDeadline, timeLeftLabel, urgency } from '@/lib/format'
import { CATEGORIES, ROLE_KEYS, type Role } from '@/lib/constants'
import { TOPICS } from '@/lib/topics'
import { issueLinkToken, linkPageUrl } from './link'
import { WELCOME_IMAGE, absoluteUrl, eventsCarousel, noticeFlex, textMessage, type NoticeContent, type QuickReply } from './messaging'
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

const MEMBER_QUICK: QuickReply[] = [
  { label: '🏆 งานที่เปิดรับ', data: 'm:open' },
  { label: '⏰ ใกล้ปิดรับ', data: 'm:closing' },
  { label: '⭐ ตรงกับฉัน', data: 'm:foryou' },
  { label: '👥 หาทีม', data: 'm:teams' },
  { label: '🎯 เลือกความสนใจ', data: 'm:interests' },
  { label: '🌐 เปิดเว็บ', url: '/?src=line' },
]
const GUEST_QUICK: QuickReply[] = [
  { label: '🚀 สมัครสมาชิกฟรี', data: 'm:join' },
  { label: '🏆 งานที่เปิดรับ', data: 'm:open' },
  { label: '⏰ ใกล้ปิดรับ', data: 'm:closing' },
  { label: '👥 หาทีม', data: 'm:teams' },
  { label: '🌐 เปิดเว็บ', url: '/?src=line' },
]
/** Quick replies under a message: guests always see "สมัครสมาชิกฟรี" first. */
export const quickFor = (p: Linked | null) => (p ? MEMBER_QUICK : GUEST_QUICK)
export const MENU_QUICK = MEMBER_QUICK
const quickMsg = (text: string, p: Linked | null) => textMessage(text, quickFor(p))

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
    return web('/settings/notifications')
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
      quickMsg('สมัครฟรีได้เลย หรือดูงานก่อนก็ได้ 👇', null),
    ]
  }
  return [
    noticeFlex({
      ...base,
      actions: [
        { type: 'postback', label: 'ดูงานที่ตรงกับฉัน', data: 'm:foryou', displayText: 'งานที่ตรงกับฉัน' },
        { type: 'uri', label: 'เปิดเว็บไซต์', url: web('/') },
      ],
    }),
    interestPicker(profile, profile.interests.length ? 'อยากเปลี่ยนเรื่องที่สนใจไหม?' : 'ขั้นสุดท้าย: เลือกเรื่องที่สนใจ'),
  ]
}

/** Tappable interest toggles + "notify me about matching events" switch. */
export function interestPicker(p: Linked, heading = 'เลือกเรื่องที่สนใจ'): LineMessage {
  const chosen = new Set(p.interests)
  const row = (r: Role) => ({
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    paddingAll: '10px',
    cornerRadius: '10px',
    backgroundColor: chosen.has(r) ? '#E8EEFB' : '#F8FAFC',
    borderColor: chosen.has(r) ? '#0035AD' : '#E2E8F0',
    borderWidth: '1px',
    action: { type: 'postback', label: INTEREST_LABEL[r].slice(0, 20), data: `m:t:${r}` },
    contents: [
      { type: 'text', text: INTEREST_LABEL[r], size: 'sm', color: '#10233F', flex: 1, weight: chosen.has(r) ? 'bold' : 'regular' },
      { type: 'text', text: chosen.has(r) ? '✓' : '＋', size: 'sm', color: chosen.has(r) ? '#0035AD' : '#94A3B8', flex: 0, weight: 'bold' },
    ],
  })
  return {
    type: 'flex',
    altText: 'เลือกเรื่องที่สนใจ',
    contents: {
      type: 'bubble',
      size: 'mega',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: heading, weight: 'bold', size: 'lg', color: '#10233F', wrap: true },
          { type: 'text', text: 'แตะเพื่อเลือก/เอาออก (เลือกได้หลายข้อ) — ใช้แนะนำงานและทีมให้ตรงกับคุณ', size: 'xs', color: '#64748B', wrap: true },
          { type: 'separator', margin: 'md', color: '#FFFFFF' },
          ...ROLE_KEYS.map(row),
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'lg',
            paddingAll: '12px',
            cornerRadius: '10px',
            backgroundColor: p.notify_matches ? '#FFF6DB' : '#F1F5F9',
            action: { type: 'postback', label: 'แจ้งเตือนตามความสนใจ', data: `m:n:${p.notify_matches ? 'off' : 'on'}` },
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: '🔔 แจ้งเตือนงานที่ตรงกับความสนใจ', size: 'sm', weight: 'bold', color: '#10233F', wrap: true },
                  { type: 'text', text: 'สรุปส่งทาง LINE สัปดาห์ละครั้ง', size: 'xxs', color: '#64748B' },
                ],
              },
              { type: 'text', text: p.notify_matches ? 'เปิด ✓' : 'ปิด', size: 'sm', weight: 'bold', color: p.notify_matches ? '#B45309' : '#64748B', flex: 0, gravity: 'center' },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '14px',
        paddingTop: '4px',
        contents: [
          { type: 'button', style: 'primary', color: '#0035AD', height: 'md', action: { type: 'postback', label: 'เสร็จแล้ว — ดูงานที่ตรงกับฉัน', data: 'm:foryou', displayText: 'งานที่ตรงกับฉัน' } },
          { type: 'button', style: 'secondary', color: '#EEF2FA', height: 'sm', action: { type: 'uri', label: 'แก้โปรไฟล์บนเว็บ', uri: absoluteUrl(web('/me')) } },
        ],
      },
    },
  }
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
        { type: 'postback', label: 'เลือกเรื่องที่สนใจ', data: 'm:interests', displayText: 'เลือกเรื่องที่สนใจ' },
        { type: 'uri', label: 'ตั้งค่าแจ้งเตือนบนเว็บ', url: web('/settings/notifications') },
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
      textMessage(closingSoon ? 'ไม่มีงานที่ปิดรับภายใน 7 วัน 🎉 ดูงานที่เปิดรับทั้งหมดได้เลย' : 'ตอนนี้ยังไม่มีงานที่เปิดรับ — มีงานใหม่เมื่อไหร่ เราจะบอก', [
        { label: '🏆 งานที่เปิดรับ', data: 'm:open' },
        { label: '🌐 เปิดเว็บ', url: web('/opportunities') },
      ]),
    ]
  }
  return [
    eventsCarousel(closingSoon ? 'งานที่ใกล้ปิดรับใน 7 วัน' : 'งานแข่ง & ทุนที่เปิดรับ', events.slice(0, 9).map((ev) => eventItem(ev)), web(more)),
    quickMsg(
      (closingSoon ? `⏰ ${events.length} งานปิดรับภายใน 7 วัน — เลื่อนดูได้เลย` : `🏆 เปิดรับอยู่ ${events.length} งาน เรียงตามวันปิดรับ — เลื่อนดู หรือเปิดดูทั้งหมดบนเว็บ`) +
        (p ? '' : '\n\n🚀 สมัครสมาชิกฟรี เพื่อรับงานที่ตรงกับคุณและเตือนก่อนปิดรับ'),
      p,
    ),
  ]
}

export async function forYou(lineUserId: string, p: Linked | null): Promise<LineMessage[]> {
  if (!p) return [await linkInvite(lineUserId, 'สมัครสมาชิกฟรี เพื่อดูงานที่ตรงกับคุณ ⭐')]
  if (!p.interests.length) return [interestPicker(p, 'เลือกเรื่องที่สนใจก่อน แล้วเราจะหางานที่ตรงให้')]
  const matches = (await listPublishedEvents())
    .filter((ev) => !isClosed(ev))
    .map((ev) => ({ ev, why: fitsInterests(ev, p.interests) }))
    .filter((x): x is { ev: EventRow; why: string } => Boolean(x.why))
    .sort((a, b) => byDeadline(a.ev, b.ev))
  if (!matches.length) {
    return [
      textMessage('ตอนนี้ยังไม่มีงานที่ตรงกับความสนใจของคุณเปิดรับอยู่ — ลองเลือกเพิ่ม หรือดูงานทั้งหมด', [
        { label: '🎯 เลือกความสนใจ', data: 'm:interests' },
        { label: '🏆 งานที่เปิดรับ', data: 'm:open' },
      ]),
    ]
  }
  return [
    eventsCarousel('งานที่ตรงกับคุณ', matches.slice(0, 9).map((m) => eventItem(m.ev, `ตรงกับ ${m.why}`)), web('/opportunities')),
    quickMsg(`⭐ ${matches.length} งานตรงกับความสนใจของคุณ — แก้ความสนใจได้ที่ “🎯 เลือกความสนใจ”`, p),
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
        { type: 'uri', label: 'ประกาศหาทีม', url: web('/teams/looking/new') },
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
        : [await linkInvite(lineUserId, 'สมัครสมาชิก Mahidol Startup Club ฟรี 🚀'), quickMsg('หรือดูงานก่อนก็ได้ 👇', null)]
    case 'foryou':
      return forYou(lineUserId, p)
    case 'teams':
      return teams(p?.id ?? null)
    case 'help':
      return [help(), quickMsg('หรือเลือกจากเมนู 👇', p)]
    case 'account':
      return account(lineUserId, p)
    case 'welcome':
      return welcome(lineUserId, p)
    case 'interests':
      return p ? [interestPicker(p)] : [await linkInvite(lineUserId, 'สมัครสมาชิกฟรี เพื่อเลือกเรื่องที่สนใจ 🎯')]
    case 't': // toggle one interest
    case 'n': {
      // switch "notify me about matches"
      if (!p) return [await linkInvite(lineUserId, 'สมัครสมาชิกฟรี เพื่อเลือกเรื่องที่สนใจ 🎯')]
      const patch: Partial<Linked> = {}
      if (action === 't' && (ROLE_KEYS as string[]).includes(arg)) {
        patch.interests = p.interests.includes(arg) ? p.interests.filter((x) => x !== arg) : [...p.interests, arg]
      } else if (action === 'n') {
        patch.notify_matches = arg === 'on'
      }
      const { data: updated } = await adminClient().from('profiles').update(patch).eq('id', p.id).select(PROFILE_COLS).single()
      p = (updated as Linked) ?? { ...p, ...patch }
      return [interestPicker(p, 'บันทึกแล้ว ✓ — เลือกต่อได้เลย')]
    }
    default:
      return [quickMsg('เลือกจากเมนูด้านล่างได้เลย 👇', p)]
  }
}
