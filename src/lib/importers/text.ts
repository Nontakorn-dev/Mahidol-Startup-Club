// Text and date helpers shared by the source adapters.

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** HTML fragment → readable plain text with line breaks kept. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol|figure|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\r/g, '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Markdown-ish source text (Contester) → plain text. */
export function markdownToText(md: string): string {
  return htmlToText(
    md
      .replace(/\\([[\]()*_#>`~-])/g, '$1')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1 ($2)')
      .replace(/^\s*[-*]\s+/gm, '• '),
  )
}

/** Drop values that are leftovers of a page format rather than real text ("$2c", "$undefined"). */
export function cleanValue(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s || s === '$undefined' || s === 'null' || s === 'undefined' || /^\$[0-9a-f]{1,4}$/.test(s)) return null
  return s
}

/** Bangkok calendar date of an instant. */
export const bangkokDate = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(iso)) : null)

const TH_MONTHS: [RegExp, number][] = [
  [/^(มกราคม|ม\.?ค\.?)$/, 1],
  [/^(กุมภาพันธ์|ก\.?พ\.?)$/, 2],
  [/^(มีนาคม|มี\.?ค\.?)$/, 3],
  [/^(เมษายน|เม\.?ย\.?)$/, 4],
  [/^(พฤษภาคม|พ\.?ค\.?)$/, 5],
  [/^(มิถุนายน|มิ\.?ย\.?)$/, 6],
  [/^(กรกฎาคม|ก\.?ค\.?)$/, 7],
  [/^(สิงหาคม|ส\.?ค\.?)$/, 8],
  [/^(กันยายน|ก\.?ย\.?)$/, 9],
  [/^(ตุลาคม|ต\.?ค\.?)$/, 10],
  [/^(พฤศจิกายน|พ\.?ย\.?)$/, 11],
  [/^(ธันวาคม|ธ\.?ค\.?)$/, 12],
]
const TH_DATE = /(\d{1,2})\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s*(\d{2,4})?/g

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * All Thai dates in a string, as YYYY-MM-DD. Handles "16 ตุลาคม 2569", "5 พ.ย. 69", and ranges
 * like "5 - 6 พฤศจิกายน 2569" (the first day borrows the month/year of the second).
 */
export function thaiDates(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(TH_DATE)) {
    const day = Number(m[1])
    const month = TH_MONTHS.find(([re]) => re.test(m[2]))?.[1]
    let year = m[3] ? Number(m[3]) : NaN
    if (!month || day < 1 || day > 31) continue
    if (Number.isFinite(year)) {
      if (year < 100) year += 2500 // "69" → 2569
      if (year > 2400) year -= 543
    } else {
      // No year: assume the next occurrence of that date.
      const now = new Date()
      year = now.getUTCFullYear()
      if (Date.UTC(year, month - 1, day) < now.getTime() - 60 * 86_400_000) year++
    }
    const before = text.slice(Math.max(0, m.index! - 8), m.index!)
    const range = before.match(/(\d{1,2})\s*[-–]\s*$/)
    if (range) out.push(`${year}-${pad(month)}-${pad(Number(range[1]))}`)
    out.push(`${year}-${pad(month)}-${pad(day)}`)
  }
  return out
}

/**
 * Closing date written in prose: "สมัครได้ตั้งแต่วันนี้ – 31 ตุลาคม 2569", "ปิดรับสมัคร 15 พ.ย. 69",
 * "รับสมัครถึงวันที่ …", "หมดเขต …". Returns the last date in the first such phrase.
 */
export function deadlineFromText(text: string | null | undefined): string | null {
  if (!text) return null
  for (const m of text.matchAll(/(ปิดรับ(สมัคร)?|รับสมัคร(ได้)?(ถึง|ตั้งแต่|ภายใน|จนถึง|วันนี้)|สมัครได้(ตั้งแต่|ถึง|ภายใน)|หมดเขต(รับสมัคร)?|deadline)[^\n]{0,60}/gi)) {
    const dates = thaiDates(m[0])
    if (dates.length) return dates[dates.length - 1]
  }
  return null
}

/** Normalised title for matching the same opportunity across sources. */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(20\d\d|25\d\d)\b/g, ' ')
    .replace(/[^a-z0-9ก-๙]+/g, '')
}

const GENERIC = new Set(['the', 'and', 'for', 'with', 'competition', 'contest', 'challenge', 'hackathon', 'program', 'programme', 'project', 'award', 'awards', 'camp', 'season', 'thailand', 'thai', 'online', 'case', 'workshop', 'student', 'students', 'international', 'national', 'global', 'youth', 'open', 'call', 'next', 'gen'])

/** Distinctive latin words of a title (brand / event names). */
export function titleTokens(title: string): Set<string> {
  return new Set(
    (title.toLowerCase().normalize('NFKC').match(/[a-z][a-z0-9]{2,}/g) || []).filter((w) => !GENERIC.has(w)),
  )
}

/** Same opportunity listed on two sites? Title containment or strong word overlap, and nearby deadlines. */
export function sameOpportunity(a: { title: string; deadline: string | null }, b: { title: string; deadline: string | null }): boolean {
  if (a.deadline && b.deadline) {
    const gap = Math.abs(Date.parse(a.deadline) - Date.parse(b.deadline)) / 86_400_000
    if (gap > 45) return false
  }
  const ka = titleKey(a.title)
  const kb = titleKey(b.title)
  if (ka && ka === kb) return true
  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka]
  if (short.length >= 12 && long.includes(short)) return true
  const ta = titleTokens(a.title)
  const tb = titleTokens(b.title)
  const common = [...ta].filter((w) => tb.has(w)).length
  if (common >= 2 && common / Math.min(ta.size, tb.size) >= 0.75) return true
  // "GSEA 2026-2027" ↔ "Global Student Entrepreneur Awards 2026-2027"
  return acronymOf(b.title, ta) || acronymOf(a.title, tb)
}

function acronymOf(title: string, tokens: Set<string>): boolean {
  const words = title.toLowerCase().match(/[a-z][a-z0-9]*/g) || []
  if (words.length < 3) return false
  for (let i = 0; i + 3 <= words.length; i++) {
    for (let n = 3; n <= 6 && i + n <= words.length; n++) {
      const acr = words.slice(i, i + n).map((w) => w[0]).join('')
      if (tokens.has(acr)) return true
    }
  }
  return false
}

/** Host + path of a page (keeps bare-domain pages like https://x.devpost.com/), for "same page" checks. */
export function pageKey(u: string | null | undefined): string | null {
  if (!u) return null
  try {
    const url = new URL(u)
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}`.toLowerCase()
  } catch {
    return null
  }
}

/** URL without tracking params, for comparing registration links. */
export function normalUrl(u: string | null | undefined): string | null {
  if (!u) return null
  try {
    const url = new URL(u)
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid|igshid|gclid|ref$|si$)/i.test(k)) url.searchParams.delete(k)
    const path = url.pathname.replace(/\/+$/, '')
    if (!path) return null // a bare homepage says nothing about which event it is
    return `${url.hostname.replace(/^www\./, '')}${path}${url.search}`.toLowerCase()
  } catch {
    return null
  }
}
