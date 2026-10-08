import 'server-only'
import { SourceBlocked, pause, politeGet } from '../http'
import { RELEVANCE_THRESHOLD, scoreRelevance } from '../relevance'
import { bangkokDate, decodeEntities, htmlToText } from '../text'
import type { Source, SourceItem } from '../types'

// Devpost (https://devpost.com) — global hackathon platform; organisers run their own pages.
//  • robots.txt allows all paths for `*`; the hackathon list is Devpost's public JSON endpoint
//    (/api/hackathons) that powers devpost.com/hackathons.
//  • Only online, public (not invite-only) hackathons with a real prize and real traction
//    (≥ 500 registrations, featured, or run by Devpost) — the long tail of tiny events is skipped.
//  • The hackathon page gives the exact deadline with time zone and the country exclusions;
//    listings that exclude Thailand are skipped.

const API = 'https://devpost.com/api/hackathons'
const MAX_DETAIL_PAGES = 10
const MIN_REGISTRATIONS = 500

type DevpostRaw = {
  id: number
  title: string
  url: string
  displayed_location?: { location?: string }
  open_state: string
  thumbnail_url: string | null
  submission_period_dates: string
  themes: { name: string }[]
  prize_amount: string | null
  registrations_count: number
  featured: boolean
  organization_name: string | null
  invite_only: boolean
  managed_by_devpost_badge: boolean
}

const MONTHS: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }
const TZ: Record<string, number> = { UTC: 0, GMT: 0, EST: -5, EDT: -4, CST: -6, CDT: -5, MST: -7, MDT: -6, PST: -8, PDT: -7, AKST: -9, AKDT: -8, HST: -10, BST: 1, CET: 1, CEST: 2, EET: 2, EEST: 3, IST: 5.5, ICT: 7, WIB: 7, SGT: 8, HKT: 8, PHT: 8, CST8: 8, JST: 9, KST: 9, AEST: 10, AEDT: 11, NZST: 12, NZDT: 13 }
const pad = (n: number) => String(n).padStart(2, '0')

/** "Aug 31 - Oct 23, 2026" / "Oct 06 - 08, 2026" / "Dec 15, 2026 - Jan 10, 2027" → [start, end] */
export function periodDates(s: string): [string | null, string | null] {
  const m = s.match(/([A-Z][a-z]{2}) (\d{1,2})(?:, (\d{4}))? - (?:([A-Z][a-z]{2}) )?(\d{1,2}), (\d{4})/)
  if (!m) return [null, null]
  const endMonth = MONTHS[m[4] ?? m[1]]
  const startMonth = MONTHS[m[1]]
  const endYear = Number(m[6])
  const startYear = m[3] ? Number(m[3]) : startMonth > endMonth ? endYear - 1 : endYear
  return [`${startYear}-${pad(startMonth)}-${pad(Number(m[2]))}`, `${endYear}-${pad(endMonth)}-${pad(Number(m[5]))}`]
}

/** "Deadline: Nov 2, 2026 @ 11:45am EST" → ISO instant. */
export function devpostDeadline(html: string): string | null {
  const m = html.match(/Deadline:\s*([A-Z][a-z]{2}) (\d{1,2}), (\d{4}) @ (\d{1,2}):(\d{2})\s*(am|pm)\s*([A-Z]{2,5})/)
  if (!m || !(m[7] in TZ) || !MONTHS[m[1]]) return null
  let h = Number(m[4]) % 12
  if (m[6] === 'pm') h += 12
  const utc = Date.UTC(Number(m[3]), MONTHS[m[1]] - 1, Number(m[2]), h, Number(m[5])) - TZ[m[7]] * 3_600_000
  return new Date(utc).toISOString()
}

function toItem(d: DevpostRaw): SourceItem {
  const [start, end] = periodDates(d.submission_period_dates)
  const prize = d.prize_amount ? htmlToText(d.prize_amount) : null
  const themes = (d.themes ?? []).map((t) => t.name)
  return {
    source_id: String(d.id),
    source_url: d.url,
    source_type: 'hackathon',
    title: d.title.trim(),
    organizer: d.organization_name,
    description: null,
    poster_url: d.thumbnail_url ? (d.thumbnail_url.startsWith('//') ? `https:${d.thumbnail_url}` : d.thumbnail_url) : null,
    apply_url: d.url,
    deadline_at: null,
    deadline: end,
    event_start: start,
    event_end: null,
    location: 'ออนไลน์',
    format: 'online',
    prize: prize && /\d/.test(prize) && !/^\$?0$/.test(prize) ? `รางวัลรวม ${prize}` : null,
    eligibility: null,
    levels: ['public'],
    open: d.open_state === 'open',
    hints: themes,
    typeBonus: 2,
    version: `${d.submission_period_dates}|${d.title}`,
    raw: d,
  }
}

function enrich(it: SourceItem, d: DevpostRaw, html: string): SourceItem {
  const deadlineAt = devpostDeadline(html)
  const og = html.match(/<meta property="og:description" content="([^"]*)"/)?.[1]
  const elig = html.match(/<ul[^>]*eligibility-list[^>]*>([\s\S]*?)<\/ul>/)?.[1]
  const eligibility = elig ? htmlToText(elig).replace(/×[\s\S]*$/, '').replace(/\s*\n\s*/g, ' · ').trim() : null
  const excluded = html.match(/<ul id="eligibility-countries-modal-list"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? ''
  const themes = (d.themes ?? []).map((t) => t.name).join(', ')
  const lines = [
    og ? decodeEntities(og) : null,
    themes ? `ธีม: ${themes}` : null,
    it.prize ? `${it.prize} · ผู้ลงทะเบียน ${d.registrations_count.toLocaleString('en-US')} คน` : `ผู้ลงทะเบียน ${d.registrations_count.toLocaleString('en-US')} คน`,
    eligibility ? `ใครสมัครได้: ${eligibility}` : null,
  ]
  return {
    ...it,
    description: lines.filter(Boolean).join('\n\n'),
    deadline_at: deadlineAt,
    deadline: deadlineAt ? bangkokDate(deadlineAt) : it.deadline,
    eligibility: eligibility?.slice(0, 60) ?? null,
    skip: /<li>\s*Thailand\s*<\/li>/.test(excluded) ? 'ไม่เปิดให้ผู้สมัครจากประเทศไทย' : undefined,
  }
}

/** Without the hackathon page: description from the list data, flagged for manual checks. */
function listOnly(it: SourceItem, d: DevpostRaw): SourceItem {
  const themes = (d.themes ?? []).map((t) => t.name).join(', ')
  const lines = [
    `แฮกกาธอนออนไลน์โดย ${d.organization_name ?? 'ผู้จัดบน Devpost'} (ส่งผลงาน ${d.submission_period_dates})`,
    themes ? `ธีม: ${themes}` : null,
    `${it.prize ? `${it.prize} · ` : ''}ผู้ลงทะเบียน ${d.registrations_count.toLocaleString('en-US')} คน`,
  ]
  return { ...it, description: lines.filter(Boolean).join('\n\n'), flags: [...(it.flags ?? []), 'country_unchecked', 'needs_verification'] }
}

export const devpost: Source = {
  key: 'devpost',
  name: 'Devpost',
  homepage: 'https://devpost.com/hackathons',
  trust: 'high',
  note: 'แพลตฟอร์มแฮกกาธอนระดับโลก ผู้จัดลงประกาศเอง · เลือกเฉพาะงานออนไลน์ที่คนไทยสมัครได้และมีผู้ลงทะเบียนจริงจัง',
  async fetch({ known, until }) {
    const list: DevpostRaw[] = []
    for (let page = 1; page <= 2; page++) {
      if (page > 1) await pause(800)
      const res = JSON.parse(await politeGet(`${API}?status[]=open&order_by=deadline&per_page=40&page=${page}`, 'application/json')) as { hackathons: DevpostRaw[]; meta: { total_count: number; per_page: number } }
      list.push(...res.hackathons)
      if (page * res.meta.per_page >= res.meta.total_count) break
    }
    const items: SourceItem[] = []
    const seen: string[] = []
    let pages = 0
    let pagesBlocked = false
    for (const d of list) {
      const it = toItem(d)
      const k = known.get(it.source_id)
      if (k && k.version === it.version) {
        seen.push(it.source_id)
        continue
      }
      if (d.invite_only) it.skip = 'เฉพาะผู้ได้รับเชิญ'
      else if ((d.displayed_location?.location ?? '') !== 'Online') it.skip = `จัดในสถานที่ต่างประเทศ (${d.displayed_location?.location ?? '—'})`
      else if (d.registrations_count < MIN_REGISTRATIONS && !d.featured && !d.managed_by_devpost_badge) it.skip = `ผู้ลงทะเบียนน้อย (${d.registrations_count})`
      else if (!it.prize) it.skip = 'ไม่มีเงินรางวัล'
      if (it.skip || !it.open || scoreRelevance(it).score < RELEVANCE_THRESHOLD) {
        items.push(it)
        continue
      }
      if (pagesBlocked) {
        items.push(listOnly(it, d))
        continue
      }
      if (pages >= MAX_DETAIL_PAGES || Date.now() > until) continue
      await pause(800)
      pages++
      try {
        items.push(enrich(it, d, await politeGet(d.url)))
      } catch (err) {
        // Hackathon sites live on organiser subdomains and some refuse bots — respect that and
        // use the list data (date-only deadline, countries unchecked) instead of retrying.
        if (!(err instanceof SourceBlocked)) throw err
        pagesBlocked = true
        items.push(listOnly(it, d))
      }
    }
    return { items, seen, scanned: list.length }
  },
}
