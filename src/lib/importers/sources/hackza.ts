import 'server-only'
import { politeGet } from '../http'
import { jsonAfterKey, resolveRefs, rscPayload, rscTextRows } from '../rsc'
import { bangkokDate, cleanValue } from '../text'
import type { Level, Source, SourceItem } from '../types'

// Hackza (https://www.hackza.org) — Thai hackathon / camp / case-competition directory.
//  • No public API; robots.txt allows / but disallows /api/ — we never call their JSON endpoints.
//  • /hackathons is a prerendered Next.js page embedding every open listing as
//    `initialOpportunities` in its RSC payload: one allowed GET per sync returns everything.
//  • Descriptions live in RSC text rows ("$2c" references) — resolved with rscTextRows().

const ORIGIN = 'https://www.hackza.org'

type HackzaRaw = {
  id: string
  slug: string
  title: string
  organizer: string | null
  banner_url: string | null
  description: string | null
  type: string
  target_audience: string[] | null
  categories: string[] | null
  format: string | null
  location: string | null
  registration_deadline: string | null
  event_start_date: string | null
  event_end_date: string | null
  prize_pool: string | null
  perks: string[] | null
  source_post_url: string | null
  registration_url: string | null
  status: string
}

const TYPE_BONUS: Record<string, number> = { business_case: 3, camp_workshop: 1, hackathon: 2, exchange: -2 }
const AUDIENCE: Record<string, Level> = { university: 'university', public: 'public', high_school: 'high_school' }

export function parseHackza(html: string): HackzaRaw[] {
  const payload = rscPayload(html)
  const list = jsonAfterKey(payload, 'initialOpportunities')
  if (!Array.isArray(list)) throw new Error('Hackza page structure changed: initialOpportunities not found')
  return resolveRefs(list as HackzaRaw[], rscTextRows(payload)).map((it) => {
    // Some listings repeat the title twice back-to-back ("X HackathonX Hackathon").
    const t = it.title?.trim() ?? ''
    const half = t.length / 2
    return { ...it, title: t.length % 2 === 0 && t.slice(0, half) === t.slice(half) ? t.slice(0, half) : t }
  })
}

function toItem(it: HackzaRaw): SourceItem {
  const deadline = bangkokDate(it.registration_deadline)
  // Hackza fills unknown event dates with the deadline — only keep real ones.
  const realDate = (d: string | null) => (d && bangkokDate(d) !== deadline ? bangkokDate(d) : null)
  const sourceUrl = `${ORIGIN}/hackathons/${it.slug}`
  return {
    source_id: it.id,
    source_url: sourceUrl,
    source_type: it.type,
    title: it.title,
    organizer: cleanValue(it.organizer),
    description: cleanValue(it.description),
    poster_url: cleanValue(it.banner_url),
    apply_url: cleanValue(it.registration_url) || cleanValue(it.source_post_url),
    deadline_at: it.registration_deadline,
    deadline,
    event_start: realDate(it.event_start_date),
    event_end: realDate(it.event_end_date),
    location: cleanValue(it.location),
    format: it.format === 'online' || it.format === 'hybrid' || it.format === 'onsite' ? it.format : null,
    prize: it.prize_pool ? `รางวัล ${it.prize_pool}` : cleanValue(it.perks?.[0]),
    eligibility: null,
    levels: (it.target_audience ?? []).map((a) => AUDIENCE[a]).filter(Boolean),
    open: it.status === 'open',
    hints: it.categories ?? [],
    typeBonus: TYPE_BONUS[it.type] ?? 0,
    raw: it,
  }
}

export const hackza: Source = {
  key: 'hackza',
  name: 'Hackza',
  homepage: `${ORIGIN}/hackathons`,
  trust: 'high',
  note: 'รวมแฮกกาธอน/ค่าย/เคสธุรกิจในไทย มีวันปิดรับพร้อมเวลา · อ่านจากหน้า /hackathons หน้าเดียว (robots ห้าม /api/)',
  async fetch() {
    const items = parseHackza(await politeGet(`${ORIGIN}/hackathons`)).map(toItem)
    return { items, seen: [], scanned: items.length }
  },
}
