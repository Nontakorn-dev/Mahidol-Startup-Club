import 'server-only'
import { listCofounders, listSeekers, listTeams } from '@/lib/data/community'
import { listPublishedEvents } from '@/lib/data/events'
import { isClosed } from '@/lib/format'
import { CATEGORIES, ROLES, TRACKS, type Role, type Track } from '@/lib/constants'
import { encodeIntent, type Intent } from '@/lib/ai/intent'
import { ATTR_LABEL, ATTRS, hasAttr, prizeBaht, topicOf } from '@/lib/topics'
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

const squash = (s: string) => s.toLowerCase().replace(/[\s\-_./]+/g, '')

/** Words that count as a hit for a keyword: the topic's match words when it is a known topic
 *  (not its label — "เมือง" alone is too common in Thai), else the keyword itself. */
function variants(k: string): string[] {
  const topic = topicOf(k)
  return [...new Set(topic ? topic.match : [k])].filter((w) => w.length > 1)
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The keywords that appear in the text (any variant of a keyword counts). Latin words must
 *  start a word ("city" must not hit "capacity"); Thai has no spaces, so it matches anywhere —
 *  Thai match words in src/lib/topics.ts are therefore kept specific ("การพัฒนาเมือง", not "เมือง"). */
const kwMatches = (text: string, keywords: string[]) => {
  const lower = text.toLowerCase()
  const t = squash(text)
  return keywords.filter((k) =>
    variants(k).some((v) =>
      /^[a-z0-9]/.test(v)
        ? // short words ("app", "web", "ai") must be whole words; longer ones may be a prefix ("sustainab…")
          new RegExp(`(^|[^a-z0-9])${esc(v)}${v.length <= 4 ? '([^a-z]|$)' : ''}`).test(lower) || (v.length > 6 && t.includes(v))
        : t.includes(v),
    ),
  )
}
const kwHit = (text: string, keywords: string[]) => kwMatches(text, keywords).length

const label = (roles: string[]) => roles.map((r) => ROLES[r as Role] ?? r).join(', ')

/** Turn a parsed intent into filtered, scored results with rule-based reasons. */
export async function runSearch(intent: Intent, viewerId: string | null): Promise<SearchResults> {
  const allEvents = await listPublishedEvents()
  const focusEvent = intent.event_slug ? allEvents.find((e) => e.slug === intent.event_slug) ?? null : null

  // ---- events
  // A topic the user asked for ("การแพทย์", "fintech") is the main filter; type and skills only
  // rank. Events that match the type but not the topic are kept aside and shown only when
  // nothing on that topic is open, labelled as such.
  const strict: Ranked<EventRow>[] = []
  const nearby: Ranked<EventRow>[] = []
  const wantsTopic = intent.keywords.length > 0
  for (const e of allEvents) {
    const closed = isClosed(e)
    if (closed && !intent.include_closed && e.slug !== intent.event_slug) continue
    if (intent.deadline_from && e.deadline && e.deadline < intent.deadline_from) continue
    if (intent.deadline_to && e.deadline && e.deadline > intent.deadline_to) continue
    if (e.slug === intent.event_slug) {
      strict.push({ item: e, score: 100, reason: 'คืองานที่คุณพูดถึง' })
      continue
    }
    // Attributes the user asked for (ออนไลน์, ฟรี, ต่างประเทศ…) are hard requirements.
    if (!intent.attrs.every((a) => hasAttr(e, a))) continue
    let score = 0
    const reasons: string[] = []
    const prize = intent.attrs.includes('prize') ? prizeBaht(e) : 0
    if (prize) {
      score += Math.min(6, Math.log10(prize))
      reasons.push(`รางวัลรวม ~${prize >= 1_000_000 ? `${+(prize / 1_000_000).toFixed(1)} ล้านบาท` : `${Math.round(prize).toLocaleString('en-US')} บาท`}`)
    }
    for (const a of intent.attrs) if (a !== 'prize') reasons.push(ATTR_LABEL[a])
    // Tags are auto-derived guesses, so topics match only the event's own text.
    const topics = kwMatches(`${e.title} ${e.summary ?? ''} ${e.overview ?? ''} ${e.organizer ?? ''} ${e.location ?? ''}`, intent.keywords)
    if (topics.length) {
      score += 4 * topics.length
      reasons.push(`ตรงเรื่อง ${topics.join(', ')}`)
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
    // Most specific reason first: the topic, then the prize, then attributes / type / skills.
    const rank = (r: string) => (r.startsWith('ตรงเรื่อง') ? 0 : r.startsWith('รางวัลรวม') ? 1 : r.startsWith('ตรงประเภท') ? 3 : 2)
    reasons.sort((x, y) => rank(x) - rank(y))
    const matchedSomething = score > 0 || intent.attrs.length > 0
    if (!closed) score += 1
    if (e.is_club) score += 0.5
    const ranked = { item: e, score, reason: reasons.slice(0, 2).join(' · ') || (closed ? 'ปิดรับแล้ว — ดูไว้เป็นข้อมูล' : 'เปิดรับสมัครอยู่ตอนนี้') }
    // Topic and type the user asked for must both match ("ทุน" + "AI" = AI grants). Events that
    // match only one wait in `nearby`, shown (labelled) when nothing matches both.
    const typeOk = !intent.categories.length || intent.categories.includes(e.category)
    const topicOk = !wantsTopic || topics.length > 0
    if (!typeOk || !topicOk) {
      if (topics.length || (typeOk && !wantsTopic) || (typeOk && intent.categories.length)) nearby.push({ ...ranked, missing: !topicOk ? 'topic' : 'type' } as Ranked<EventRow>)
      continue
    }
    const filtered = Boolean(intent.categories.length || wantsTopic || tagHits.length || intent.attrs.length)
    if (filtered && !matchedSomething) continue
    strict.push({ ...ranked, prize } as Ranked<EventRow> & { prize: number })
  }
  const typeText = intent.categories.map((c) => CATEGORIES[c]).join('/')
  const topicText = intent.keywords.join(', ')
  // Prefer the closer misses: right topic but other type, before right type but other topic.
  nearby.sort((a, b) => Number((a as { missing?: string }).missing === 'topic') - Number((b as { missing?: string }).missing === 'topic') || b.score - a.score)
  const events =
    strict.some((r) => r.item.slug !== intent.event_slug) || !nearby.length
      ? strict
      : [
          ...strict,
          ...nearby.map((r) => ({
            ...r,
            reason:
              (r as { missing?: string }).missing === 'type'
                ? `ยังไม่มี${typeText}เรื่อง ${topicText} ที่เปิดอยู่ — ${r.reason}`
                : `ยังไม่มีงานเรื่อง ${topicText} ที่เปิดอยู่ — ${r.reason}`,
          })),
        ]
  // "รางวัลเยอะ": biggest prize first.
  if (intent.attrs.includes('prize')) events.sort((a, b) => ((b as { prize?: number }).prize ?? 0) - ((a as { prize?: number }).prize ?? 0) || b.score - a.score)
  else events.sort((a, b) => b.score - a.score)

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
  for (const a of intent.attrs)
    chips.push({ key: `attr-${a}`, kind: 'เงื่อนไข', label: ATTR_LABEL[a], removeHref: href({ ...intent, attrs: intent.attrs.filter((x) => x !== a) }) })
  if (intent.include_closed)
    chips.push({ key: 'closed', kind: 'รวม', label: 'งานที่ปิดรับแล้ว', removeHref: href({ ...intent, include_closed: false }) })
  return chips
}

export function addChipHref(intent: Intent, q: string, patch: Partial<Intent>) {
  return `/search?q=${encodeURIComponent(q)}&f=${encodeIntent({ ...intent, ...patch })}`
}
