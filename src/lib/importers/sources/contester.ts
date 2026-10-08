import 'server-only'
import { pause, politeGet } from '../http'
import { jsonAt, resolveRefs, rscPayload, rscTextRows } from '../rsc'
import { bangkokDate, cleanValue, markdownToText } from '../text'
import type { Level, Source, SourceItem } from '../types'

// Contester.Life (https://contester.life) — Thai competitions / camps / workshops posted by organisers
// and student clubs, reviewed by the site ("approval_status: APPROVED").
//  • robots.txt allows everything except /api/, /admin/, /editor/, /signin, /register.
//  • The home page server-renders the 10 newest contests with full data (education level, which
//    universities may apply, exact closing time). Synced every ~6 h, that catches new posts.
//  • Older-but-open contests: sitemap.xml lists every contest page with lastmod; each page embeds
//    a schema.org Event (JSON-LD) with dates, description and registration link. Only new/changed
//    pages are fetched, a few per run, with a pause between requests.

const ORIGIN = 'https://contester.life'
const MAX_DETAIL_PAGES = 15

type ContesterRaw = {
  id: number
  slug: string
  title: string
  description: string | null
  open_date: string | null
  closing_date: string | null
  contest_format: string | null
  opportunity_type: string | null
  educational_level: string[] | null
  universities: { university_id: string }[] | null
  link: string[] | null
  poster_url: string | null
  publisher_name: string | null
  approval_status: string
  edited_timestamp: string | null
  team_allowed: boolean | null
  team_max: number | null
  entry_fee: number | null
  region: string[] | null
  categories: { name: string }[] | null
  prize: { total_prize_value?: number; certificate?: boolean; internship?: boolean; trophy?: boolean } | null
}

const FORMAT: Record<string, SourceItem['format']> = { ONLINE: 'online', ONSITE: 'onsite', HYBRID: 'hybrid' }
// Contester's university codes — "ANY" (or ours) means Mahidol students can join.
const OPEN_TO_US = new Set(['ANY', 'MU', 'MAHIDOL'])

function levelsFrom(codes: string[] | null | undefined): Level[] {
  const out = new Set<Level>()
  for (const c of codes ?? []) {
    if (/ANY|ALL|GENERAL|PUBLIC/.test(c)) out.add('public')
    else if (/HIGH|SECONDARY|MATTAYOM/.test(c)) out.add('high_school')
    else if (/BACHELOR|MASTER|PHD|DOCTOR|UNIVERSITY|UNDERGRAD|VOCATIONAL/.test(c)) out.add('university')
  }
  return [...out]
}

function prizeText(p: ContesterRaw['prize']): string | null {
  if (!p) return null
  if (p.total_prize_value && p.total_prize_value > 0) return `รางวัลรวม ${p.total_prize_value.toLocaleString('en-US')} บาท`
  const perks = [p.trophy && 'ถ้วยรางวัล', p.internship && 'โอกาสฝึกงาน', p.certificate && 'เกียรติบัตร'].filter(Boolean)
  return perks.length ? perks.join(' · ') : null
}

/** "เฉพาะนิสิตจุฬาฯ" style restrictions written only in the text. */
const INTERNAL = /เฉพาะ\s*(นิสิต|นักศึกษา)\s*(จุฬา|ธรรมศาสตร์|เกษตร|มธ|มก|ม\.|คณะ|ภายใน)|(นิสิต|นักศึกษา)\s*(จุฬาฯ?|มธ\.?)\s*(เท่านั้น|ทุกชั้นปี)|ภายในมหาวิทยาลัย/

function fromListing(c: ContesterRaw): SourceItem | null {
  if (c.approval_status !== 'APPROVED') return null
  const unis = (c.universities ?? []).map((u) => u.university_id)
  const description = c.description ? markdownToText(c.description) : null
  const flags: string[] = []
  if (unis.length && !unis.some((u) => OPEN_TO_US.has(u))) flags.push(`internal_only:${unis.join(',')}`)
  else if (description && INTERNAL.test(description)) flags.push('internal_only')
  return {
    source_id: c.slug,
    source_url: `${ORIGIN}/contest/${c.slug}`,
    source_type: c.opportunity_type ?? 'CONTEST',
    title: c.title.trim(),
    organizer: cleanValue(c.publisher_name),
    description,
    poster_url: cleanValue(c.poster_url),
    apply_url: cleanValue(c.link?.[0]),
    deadline_at: c.closing_date,
    deadline: bangkokDate(c.closing_date),
    event_start: null,
    event_end: null,
    location: c.region?.includes('BANGKOK_METROPOLITAN') ? 'กรุงเทพฯ และปริมณฑล' : null,
    format: FORMAT[c.contest_format ?? ''] ?? null,
    prize: prizeText(c.prize),
    eligibility: null,
    levels: levelsFrom(c.educational_level),
    open: Boolean(c.closing_date && Date.parse(c.closing_date) > Date.now()),
    hints: (c.categories ?? []).map((x) => x.name),
    typeBonus: c.opportunity_type === 'WORKSHOP' ? 1 : 0,
    flags,
    version: c.edited_timestamp,
    raw: c,
  }
}

/** The 10 newest contests from the home page's dehydrated react-query state. */
export function parseContesterHome(html: string): ContesterRaw[] {
  const payload = rscPayload(html)
  const rows = rscTextRows(payload)
  const out: ContesterRaw[] = []
  for (const m of payload.matchAll(/"message":"Successfully fetched contests","data":\{"items":/g)) {
    const arr = jsonAt(payload, m.index! + m[0].length) as ContesterRaw[]
    out.push(...resolveRefs(arr, rows))
  }
  return out
}

type LdEvent = {
  '@type': string
  name: string
  description?: string
  startDate?: string
  endDate?: string
  eventAttendanceMode?: string
  location?: { '@type'?: string; url?: string; name?: string; address?: unknown }
  offers?: { price?: ContesterRaw['prize'] }
  category?: string
  image?: string
  url?: string
}

/** schema.org Event embedded in a contest page (it sits in an RSC text row). */
export function parseContesterDetail(html: string): LdEvent | null {
  const payload = rscPayload(html)
  const candidates = [
    ...rscTextRows(payload).values(),
    // Short JSON-LD stays inline: in the RSC JSON ("__html":"{…}") or as a plain <script>.
    ...[...payload.matchAll(/"__html":("\{(?:[^"\\]|\\.)*")/g)].map((m) => JSON.parse(m[1]) as string),
    ...[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]),
  ]
  for (const text of candidates) {
    if (!text.includes('"@type"') || !/"@type":\s*"Event"/.test(text)) continue
    try {
      return JSON.parse(text) as LdEvent
    } catch {
      /* not JSON */
    }
  }
  return null
}

function fromDetail(slug: string, ld: LdEvent, lastmod: string): SourceItem {
  const description = ld.description ? markdownToText(ld.description) : null
  return {
    source_id: slug,
    source_url: `${ORIGIN}/contest/${slug}`,
    source_type: 'CONTEST',
    title: ld.name.trim(),
    organizer: null,
    description,
    poster_url: cleanValue(ld.image),
    apply_url: ld.location?.['@type'] === 'VirtualLocation' ? cleanValue(ld.location.url) : null,
    deadline_at: ld.endDate ?? null,
    deadline: bangkokDate(ld.endDate),
    event_start: null,
    event_end: null,
    location: typeof ld.location?.name === 'string' ? ld.location.name : null,
    // The page's JSON-LD says "Online" for every contest (even onsite ones) — not trustworthy;
    // left empty so the description decides (enrich.ts, checked against the text).
    format: null,
    prize: prizeText(ld.offers?.price ?? null),
    eligibility: null,
    levels: [],
    open: Boolean(ld.endDate && Date.parse(ld.endDate) > Date.now()),
    hints: ld.category ? [ld.category] : [],
    flags: description && INTERNAL.test(description) ? ['internal_only'] : [],
    version: lastmod,
    raw: { slug, ld, lastmod },
  }
}

export const contester: Source = {
  key: 'contester',
  name: 'Contester.Life',
  homepage: ORIGIN,
  trust: 'medium',
  note: 'ผู้จัด/ชมรมโพสต์เอง แล้วเว็บอนุมัติ · มีเวลาปิดรับแม่นยำ แต่บางงานรับเฉพาะนิสิตมหาวิทยาลัยผู้จัด (ระบบติดธงให้)',
  async fetch({ known, until }) {
    const items: SourceItem[] = []
    const seen: string[] = []
    const home = parseContesterHome(await politeGet(`${ORIGIN}/`))
    const homeSlugs = new Set(home.map((c) => c.slug))
    for (const c of home) {
      const it = fromListing(c)
      if (it) items.push(it)
    }

    await pause(800)
    const sitemap = await politeGet(`${ORIGIN}/sitemap.xml`, 'application/xml')
    const entries = [...sitemap.matchAll(/<loc>https:\/\/contester\.life\/contest\/([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)]
      .map((m) => ({ slug: decodeURIComponent(m[1]), lastmod: m[2] }))
      .filter((e) => e.slug !== 'submit' && !homeSlugs.has(e.slug))
      .sort((a, b) => b.lastmod.localeCompare(a.lastmod))

    let fetched = 0
    for (const e of entries) {
      const k = known.get(e.slug)
      if (k && k.version === e.lastmod) {
        seen.push(e.slug)
        continue
      }
      if (fetched >= MAX_DETAIL_PAGES || Date.now() > until) continue // the rest waits for the next run
      await pause(800)
      fetched++
      const ld = parseContesterDetail(await politeGet(`${ORIGIN}/contest/${encodeURIComponent(e.slug)}`))
      if (ld?.name) items.push(fromDetail(e.slug, ld, e.lastmod))
    }
    return { items, seen, scanned: home.length + entries.length }
  },
}
