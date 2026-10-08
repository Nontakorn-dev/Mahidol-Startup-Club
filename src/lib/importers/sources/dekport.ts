import 'server-only'
import { todayBangkok } from '@/lib/format'
import { pause, politeGet } from '../http'
import { RELEVANCE_THRESHOLD, scoreRelevance } from '../relevance'
import { jsonAfterKey, jsonAt, resolveRefs, rscPayload, rscTextRows } from '../rsc'
import { cleanValue, deadlineFromText, markdownToText } from '../text'
import type { Level, Source, SourceItem } from '../types'

// DekPort (https://dekport.com) — Thai competition / camp directory.
//  • robots.txt explicitly allows /competitions and /competitions/* (and disallows /api/).
//  • Category pages (business, technology) server-render their listings as `initialEvents`;
//    the competition page adds the registration link and full description.
//  • Dates on DekPort have been wrong before (e.g. deadline a few days off the official page),
//    so every DekPort item is flagged "needs_verification" for the reviewer.

const ORIGIN = 'https://dekport.com'
const CATEGORY_PAGES = ['/competitions/business', '/competitions/technology']
const MAX_DETAIL_PAGES = 10

type DekportRaw = {
  id: string
  slug: string
  title: string
  description: string | null
  content?: string | null
  image_url: string | null
  poster_url?: string | null
  organizer: string | null
  location: string | null
  province: string | null
  start_date: string | null
  end_date?: string | null
  registration_end: string | null
  fee: number | string | null
  prize_pool: number | string | null
  category: string | null
  is_online: boolean | null
  education_level: string[] | null
  requirements?: string[] | null
  tags: string[] | null
  registration_url?: string | null
  website_url?: string | null
  status?: string
}

function levelsFrom(levels: string[] | null): Level[] {
  const out = new Set<Level>()
  for (const l of levels ?? []) {
    if (/ปริญญา|อุดมศึกษา|ปวส|มหาวิทยาลัย/.test(l)) out.add('university')
    else if (/ทั่วไป/.test(l)) out.add('public')
    else if (/ม\.|มัธยม|ประถม/.test(l)) out.add('high_school')
  }
  return [...out]
}

const dateOnly = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null)

function toItem(d: DekportRaw): SourceItem {
  const body0 = cleanValue(d.content) && (d.content as string).length > (d.description?.length ?? 0) ? (d.content as string) : d.description
  const deadline = dateOnly(d.registration_end) ?? deadlineFromText(body0)
  const prize = Number(d.prize_pool) > 0 ? `รางวัลรวม ${Number(d.prize_pool).toLocaleString('en-US')} บาท` : null
  const body = body0
  return {
    source_id: d.id,
    source_url: `${ORIGIN}/competition/${d.slug}`,
    source_type: d.category ?? 'competition',
    title: d.title.trim(),
    organizer: cleanValue(d.organizer),
    description: body ? markdownToText(body) : null,
    poster_url: cleanValue(d.poster_url) ?? cleanValue(d.image_url),
    apply_url: cleanValue(d.registration_url) ?? cleanValue(d.website_url),
    deadline_at: null, // DekPort stores dates at midnight UTC — the time isn't real
    deadline,
    event_start: dateOnly(d.start_date) !== deadline ? dateOnly(d.start_date) : null,
    event_end: d.end_date && dateOnly(d.end_date) !== deadline ? dateOnly(d.end_date) : null,
    location: d.is_online ? 'ออนไลน์' : cleanValue(d.province) ?? cleanValue(d.location),
    format: d.is_online ? 'online' : d.location ? 'onsite' : null,
    prize,
    eligibility: d.requirements?.length ? d.requirements.slice(0, 2).join(' · ') : null,
    levels: levelsFrom(d.education_level),
    open: (d.status ?? 'published') === 'published' && (!deadline || deadline >= todayBangkok()),
    hints: [d.category ?? '', ...(d.tags ?? [])],
    typeBonus: /ธุรกิจ/.test(d.category ?? '') ? 2 : 0,
    flags: ['needs_verification'],
    version: `${d.registration_end}|${d.title}`,
    raw: d,
  }
}

function parseListing(html: string): DekportRaw[] {
  const payload = rscPayload(html)
  const list = jsonAfterKey(payload, 'initialEvents')
  if (!Array.isArray(list)) throw new Error('DekPort page structure changed: initialEvents not found')
  return resolveRefs(list as DekportRaw[], rscTextRows(payload))
}

function parseDetail(html: string, slug: string): DekportRaw | null {
  const payload = rscPayload(html)
  const rows = rscTextRows(payload)
  for (const m of payload.matchAll(/"registration_url":/g)) {
    const start = payload.lastIndexOf('{"id":"', m.index!)
    if (start < 0) continue
    try {
      const o = resolveRefs(jsonAt(payload, start) as DekportRaw, rows)
      if (o.slug === slug) return o
    } catch {
      /* try the next one */
    }
  }
  return null
}

export const dekport: Source = {
  key: 'dekport',
  name: 'DekPort',
  homepage: `${ORIGIN}/competitions`,
  trust: 'medium',
  note: 'รวมงานแข่งหมวดธุรกิจ/เทคโนโลยี มีระดับการศึกษาให้กรอง · เคยพบวันปิดรับคลาดเคลื่อน จึงติดธง “ตรวจกับประกาศทางการ” ทุกงาน',
  async fetch({ known, until }) {
    const listing = new Map<string, DekportRaw>()
    for (const [i, path] of CATEGORY_PAGES.entries()) {
      if (i) await pause(800)
      for (const d of parseListing(await politeGet(`${ORIGIN}${path}`))) listing.set(d.id, d)
    }
    const items: SourceItem[] = []
    const seen: string[] = []
    let pages = 0
    for (const d of listing.values()) {
      const it = toItem(d)
      const k = known.get(it.source_id)
      if (k && k.version === it.version) {
        seen.push(it.source_id)
        continue
      }
      if (!it.open || scoreRelevance(it).score < RELEVANCE_THRESHOLD) {
        items.push(it)
        continue
      }
      if (pages >= MAX_DETAIL_PAGES || Date.now() > until) continue
      await pause(800)
      pages++
      const full = parseDetail(await politeGet(it.source_url), d.slug)
      items.push(full ? { ...toItem({ ...d, ...full }), version: it.version } : it)
    }
    return { items, seen, scanned: listing.size }
  },
}
