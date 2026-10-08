import 'server-only'
import { listCofounders, listSeekers, listTeams } from '@/lib/data/community'
import { listPublishedEvents } from '@/lib/data/events'
import { isClosed } from '@/lib/format'
import { CATEGORIES, ROLES, TRACKS, type Role, type Track } from '@/lib/constants'
import { encodeIntent, type Intent } from '@/lib/ai/intent'
import type { CofounderCard, EventRow, SeekerCard, TeamCard } from '@/lib/types'

export type Ranked<T> = { item: T; score: number; reason: string }

export type SearchResults = {
  events: Ranked<EventRow>[]
  teams: Ranked<TeamCard>[]
  people: Ranked<SeekerCard>[]
  cofounders: Ranked<CofounderCard>[]
  focusEvent: EventRow | null
}

const roleToTrack: Record<Role, Track> = {
  developer: 'tech',
  data_ai: 'tech',
  hardware: 'tech',
  ux_ui: 'design',
  business: 'business',
  marketing: 'marketing',
  domain_expert: 'domain_expert',
}

// Thai ↔ English and spelling variants, so "healthtech" also finds "สุขภาพ" / "health tech".
const KEYWORD_FAMILIES: string[][] = [
  ['healthtech', 'health', 'สุขภาพ', 'การแพทย์', 'medical', 'medtech'],
  ['edtech', 'education', 'การศึกษา', 'learning'],
  ['fintech', 'finance', 'การเงิน', 'banking', 'payment'],
  ['agritech', 'agriculture', 'เกษตร', 'farm'],
  ['foodtech', 'food', 'อาหาร'],
  ['esg', 'sustainability', 'sustainable', 'ความยั่งยืน', 'climate', 'green', 'สิ่งแวดล้อม'],
  ['ai', 'artificial intelligence', 'ปัญญาประดิษฐ์', 'machine learning', 'genai'],
  ['startup', 'สตาร์ตอัพ', 'สตาร์ทอัพ', 'entrepreneur', 'ผู้ประกอบการ'],
  ['innovation', 'นวัตกรรม'],
  ['energy', 'พลังงาน'],
  ['game', 'เกม', 'gaming'],
]
const squash = (s: string) => s.toLowerCase().replace(/[\s\-_./]+/g, '')

function variants(k: string): string[] {
  const key = squash(k)
  const family = KEYWORD_FAMILIES.find((f) => f.some((w) => squash(w) === key))
  return [...new Set([key, ...(family ?? []).map(squash)])].filter((w) => w.length > 1)
}

/** How many keywords appear in the text (any variant counts once). */
const kwHit = (text: string, keywords: string[]) => {
  const t = squash(text)
  return keywords.filter((k) => variants(k).some((v) => (v.length <= 3 ? new RegExp(`(^|[^a-z])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(text.toLowerCase()) : t.includes(v)))).length
}

const label = (roles: string[]) => roles.map((r) => ROLES[r as Role] ?? r).join(', ')

/** Turn a parsed intent into filtered, scored results with rule-based reasons. */
export async function runSearch(intent: Intent, viewerId: string | null): Promise<SearchResults> {
  const allEvents = await listPublishedEvents()
  const focusEvent = intent.event_slug ? allEvents.find((e) => e.slug === intent.event_slug) ?? null : null

  // ---- events
  const events: Ranked<EventRow>[] = []
  for (const e of allEvents) {
    const closed = isClosed(e)
    if (closed && !intent.include_closed && e.slug !== intent.event_slug) continue
    if (intent.deadline_from && e.deadline && e.deadline < intent.deadline_from) continue
    if (intent.deadline_to && e.deadline && e.deadline > intent.deadline_to) continue
    let score = 0
    const reasons: string[] = []
    if (e.slug === intent.event_slug) {
      score += 10
      reasons.push('คืองานที่คุณพูดถึง')
    }
    if (intent.categories.includes(e.category)) {
      score += 3
      reasons.push(`ตรงประเภท “${CATEGORIES[e.category]}”`)
    }
    const tagHits = e.tags.filter((t) => intent.my_skills.includes(t as Role))
    if (tagHits.length) {
      score += 2 * tagHits.length
      reasons.push(`ต้องการคนสาย ${label(tagHits)} แบบคุณ`)
    }
    const kw = kwHit(`${e.title} ${e.summary ?? ''} ${e.overview ?? ''} ${e.organizer ?? ''} ${e.tags.join(' ')} ${e.location ?? ''}`, intent.keywords)
    if (kw) {
      score += kw * 2
      reasons.push('ตรงกับคำค้นของคุณ')
    }
    const filtered = Boolean(intent.event_slug || intent.categories.length || intent.keywords.length || tagHits.length)
    if (filtered && score === 0) continue
    if (!closed) score += 1
    if (e.is_club) score += 0.5
    events.push({ item: e, score, reason: reasons[0] ?? (closed ? 'ปิดรับแล้ว — ดูไว้เป็นข้อมูล' : 'เปิดรับสมัครอยู่ตอนนี้') })
  }
  events.sort((a, b) => b.score - a.score)

  // ---- teams looking for people (I want to join)
  const teamPool = await listTeams(viewerId, { limit: 100 })
  const teams: Ranked<TeamCard>[] = []
  for (const t of teamPool) {
    if (t.is_mine) continue
    let score = 0
    const reasons: string[] = []
    const need = t.roles_needed.filter((r) => intent.my_skills.includes(r))
    if (need.length) {
      score += 4 * need.length
      reasons.push(`ทีมนี้กำลังหา ${label(need)} ตรงกับที่คุณทำได้`)
    }
    if (focusEvent && t.event?.id === focusEvent.id) {
      score += 3
      reasons.push(`ลง ${focusEvent.title}`)
    }
    const kw = kwHit(`${t.name} ${t.pitch} ${t.details ?? ''}`, intent.keywords)
    if (kw) {
      score += kw * 2
      reasons.push('ไอเดียตรงกับคำค้น')
    }
    if ((intent.my_skills.length || focusEvent || intent.keywords.length) && score === 0) continue
    teams.push({ item: t, score, reason: reasons.join(' · ') || 'กำลังมองหาสมาชิกเพิ่ม' })
  }
  teams.sort((a, b) => b.score - a.score)

  // ---- people looking for a team (I need people)
  const seekerPool = await listSeekers(viewerId, { limit: 100 })
  const wanted = intent.roles_needed.map((r) => ROLES[r].toLowerCase())
  const people: Ranked<SeekerCard>[] = []
  for (const s of seekerPool) {
    if (s.is_mine) continue
    let score = 0
    const reasons: string[] = []
    const hay = `${s.skills.join(' ')} ${s.looking_text}`.toLowerCase()
    const roleHits = intent.roles_needed.filter((r, i) => hay.includes(wanted[i]) || hay.includes(r.replace('_', '')))
    if (roleHits.length) {
      score += 4 * roleHits.length
      reasons.push(`ถนัด ${label(roleHits)} ที่ทีมคุณขาด`)
    }
    if (focusEvent && s.event?.id === focusEvent.id) {
      score += 3
      reasons.push(`อยากลง ${focusEvent.title} เหมือนกัน`)
    }
    const kw = kwHit(`${s.looking_text} ${s.skills.join(' ')} ${s.details ?? ''}`, intent.keywords)
    if (kw) {
      score += kw * 2
      reasons.push('สนใจเรื่องเดียวกับคำค้น')
    }
    if ((intent.roles_needed.length || focusEvent || intent.keywords.length) && score === 0) continue
    people.push({ item: s, score, reason: reasons.join(' · ') || 'กำลังมองหาทีม' })
  }
  people.sort((a, b) => b.score - a.score)

  // ---- co-founders
  const myTracks = [...new Set(intent.my_skills.map((r) => roleToTrack[r]))]
  const seekTracks = [...new Set([...intent.cofounder_seeking, ...intent.roles_needed.map((r) => roleToTrack[r])])]
  const cofounderPool = await listCofounders(viewerId, { limit: 100 })
  const cofounders: Ranked<CofounderCard>[] = []
  for (const c of cofounderPool) {
    if (c.is_mine) continue
    let score = 0
    const reasons: string[] = []
    const theyWantMe = c.seeking.filter((t) => myTracks.includes(t))
    if (theyWantMe.length) {
      score += 4
      reasons.push(`กำลังหา co-founder สาย ${theyWantMe.map((t) => TRACKS[t]).join(', ')} แบบคุณ`)
    }
    const iWantThem = c.my_skills.filter((t) => seekTracks.includes(t))
    if (iWantThem.length) {
      score += 4
      reasons.push(`ถนัด ${iWantThem.map((t) => TRACKS[t]).join(', ')} ที่คุณมองหา`)
    }
    const kw = kwHit(`${c.idea_title ?? ''} ${c.problem ?? ''} ${c.about ?? ''}`, intent.keywords)
    if (kw) {
      score += kw * 2
      reasons.push('ไอเดียตรงกับคำค้น')
    }
    if ((myTracks.length || seekTracks.length || intent.keywords.length) && score === 0) continue
    cofounders.push({ item: c, score, reason: reasons.join(' · ') || 'เปิดรับ co-founder' })
  }
  cofounders.sort((a, b) => b.score - a.score)

  return { events, teams, people, cofounders, focusEvent }
}

// ------------------------------------------------------------------ editable chips

export type Chip = { key: string; label: string; kind: string; removeHref: string }

export function intentChips(intent: Intent, q: string, eventTitle?: string | null): Chip[] {
  const href = (next: Intent) => `/search?q=${encodeURIComponent(q)}&f=${encodeIntent(next)}`
  const chips: Chip[] = []
  if (intent.event_slug)
    chips.push({ key: 'event', kind: 'งาน', label: eventTitle || intent.event_slug, removeHref: href({ ...intent, event_slug: null }) })
  for (const c of intent.categories)
    chips.push({ key: `cat-${c}`, kind: 'ประเภท', label: CATEGORIES[c], removeHref: href({ ...intent, categories: intent.categories.filter((x) => x !== c) }) })
  for (const r of intent.my_skills)
    chips.push({ key: `my-${r}`, kind: 'ฉันทำได้', label: ROLES[r], removeHref: href({ ...intent, my_skills: intent.my_skills.filter((x) => x !== r) }) })
  for (const r of intent.roles_needed)
    chips.push({ key: `need-${r}`, kind: 'ขาด', label: ROLES[r], removeHref: href({ ...intent, roles_needed: intent.roles_needed.filter((x) => x !== r) }) })
  for (const t of intent.cofounder_seeking)
    chips.push({ key: `cf-${t}`, kind: 'co-founder', label: TRACKS[t], removeHref: href({ ...intent, cofounder_seeking: intent.cofounder_seeking.filter((x) => x !== t) }) })
  for (const k of intent.keywords)
    chips.push({ key: `kw-${k}`, kind: 'คำค้น', label: k, removeHref: href({ ...intent, keywords: intent.keywords.filter((x) => x !== k) }) })
  if (intent.deadline_from || intent.deadline_to)
    chips.push({
      key: 'deadline',
      kind: 'ปิดรับ',
      label: [intent.deadline_from, intent.deadline_to].filter(Boolean).join(' → '),
      removeHref: href({ ...intent, deadline_from: null, deadline_to: null }),
    })
  if (intent.include_closed)
    chips.push({ key: 'closed', kind: 'รวม', label: 'งานที่ปิดรับแล้ว', removeHref: href({ ...intent, include_closed: false }) })
  return chips
}

export function addChipHref(intent: Intent, q: string, patch: Partial<Intent>) {
  return `/search?q=${encodeURIComponent(q)}&f=${encodeIntent({ ...intent, ...patch })}`
}
