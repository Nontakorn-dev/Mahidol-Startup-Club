// Text helpers for imported listings: cleaning values and recognising the same opportunity twice.

/** Drop values that are leftovers of a page format rather than real text ("$2c", "$undefined"). */
export function cleanValue(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s || s === '$undefined' || s === 'null' || s === 'undefined' || /^\$[0-9a-f]{1,4}$/.test(s)) return null
  return s
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
