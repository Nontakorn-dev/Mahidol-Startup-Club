import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import { todayBangkok } from '@/lib/format'
import type { Category, Role } from '@/lib/constants'

// Hackza (https://www.hackza.org) importer.
//
// Findings before writing this (Oct 2026):
//  • No public API is published. robots.txt: `Allow: /` but `Disallow: /api/` — so the site's own
//    JSON endpoints are off-limits and we never call them.
//  • /hackathons is a prerendered Next.js page that embeds every open listing (all types) as
//    `initialOpportunities` in its RSC payload — one allowed GET returns everything.
//  • No Cloudflare / CAPTCHA (served by Vercel). We send an identifying User-Agent, re-check
//    robots.txt on every run, fetch a single page per run, and the cron runs every 6 hours.
//  • Terms: posters/names belong to each organiser; Hackza shows them for public promotion and
//    honours takedowns. We keep the organiser's registration link and credit/link back to Hackza.

const ORIGIN = 'https://www.hackza.org'
const LIST_PATH = '/hackathons'
export const HACKZA_UA = `MahidolStartupClubBot/1.0 (+${env.siteUrl}; student club opportunity listing)`

export type HackzaItem = {
  id: string
  slug: string
  title: string
  organizer: string | null
  banner_url: string | null
  description: string | null
  type: string
  target_audience: string[]
  categories: string[]
  format: string | null
  location: string | null
  registration_deadline: string | null
  event_start_date: string | null
  event_end_date: string | null
  prize_pool: string | null
  reward_type: string | null
  perks: string[]
  source_post_url: string | null
  registration_url: string | null
  status: string
}

// ------------------------------------------------------------------ robots.txt

/** Minimal robots.txt check for `User-agent: *` (longest matching rule wins). */
export async function robotsAllows(path: string): Promise<boolean> {
  const res = await fetch(`${ORIGIN}/robots.txt`, { headers: { 'User-Agent': HACKZA_UA }, cache: 'no-store' })
  if (!res.ok) return res.status >= 400 && res.status < 500 // no robots.txt → allowed; 5xx → be safe
  const rules: { allow: boolean; path: string }[] = []
  let inStar = false
  for (const raw of (await res.text()).split('\n')) {
    const line = raw.split('#')[0].trim()
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const [key, value] = [m[1].toLowerCase(), m[2].trim()]
    if (key === 'user-agent') inStar = value === '*'
    else if (inStar && (key === 'allow' || key === 'disallow') && value) rules.push({ allow: key === 'allow', path: value })
  }
  const match = rules.filter((r) => path.startsWith(r.path.replace(/\*$/, ''))).sort((a, b) => b.path.length - a.path.length)[0]
  return match ? match.allow : true
}

// ------------------------------------------------------------------ fetch + parse

/**
 * RSC moves long strings into separate text rows (`2c:T5a3,<utf-8 text>`) and leaves `"$2c"` in
 * the JSON. Collect those rows so references can be swapped back for the real text.
 */
function textRows(payload: string): Map<string, string> {
  const rows = new Map<string, string>()
  const bytes = Buffer.from(payload, 'utf8')
  for (const m of payload.matchAll(/([0-9a-f]{1,4}):T([0-9a-f]+),/g)) {
    const startByte = Buffer.byteLength(payload.slice(0, m.index! + m[0].length), 'utf8')
    rows.set(m[1], bytes.subarray(startByte, startByte + parseInt(m[2], 16)).toString('utf8'))
  }
  return rows
}

/** Pull the `initialOpportunities` array out of the page's Next.js RSC payload. */
export function parseOpportunities(html: string): HackzaItem[] {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => JSON.parse(`"${m[1]}"`) as string)
  const payload = chunks.join('')
  const rows = textRows(payload)
  const resolve = (v: unknown) => {
    if (v === '$undefined') return null
    if (typeof v === 'string' && /^\$[0-9a-f]{1,4}$/.test(v)) return rows.get(v.slice(1)) ?? null
    return v
  }
  const key = '"initialOpportunities":'
  const start = payload.indexOf(key)
  if (start < 0) throw new Error('Hackza page structure changed: initialOpportunities not found')
  let i = start + key.length
  let depth = 0
  let inStr = false
  for (let j = i; j < payload.length; j++) {
    const c = payload[j]
    if (inStr) {
      if (c === '\\') j++
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '[') depth++
    else if (c === ']' && --depth === 0) {
      const arr = JSON.parse(payload.slice(i, j + 1)) as Record<string, unknown>[]
      return arr.map((o) => {
        const item = Object.fromEntries(Object.entries(o).map(([k, v]) => [k, resolve(v)])) as HackzaItem
        // Some listings repeat the title twice back-to-back ("X HackathonX Hackathon").
        const t = item.title?.trim() ?? ''
        const half = t.length / 2
        if (t.length % 2 === 0 && t.slice(0, half) === t.slice(half)) item.title = t.slice(0, half)
        return item
      })
    }
  }
  throw new Error('Hackza page structure changed: unterminated opportunities array')
}

export async function fetchHackza(): Promise<HackzaItem[]> {
  if (!(await robotsAllows(LIST_PATH))) throw new Error(`robots.txt disallows ${LIST_PATH}`)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(`${ORIGIN}${LIST_PATH}`, {
      headers: { 'User-Agent': HACKZA_UA, Accept: 'text/html' },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (res.status === 429 || res.status === 403) throw new Error(`Hackza responded ${res.status} — backing off until the next run`)
    if (!res.ok) throw new Error(`Hackza responded ${res.status}`)
    return parseOpportunities(await res.text())
  } finally {
    clearTimeout(timer)
  }
}

// ------------------------------------------------------------------ relevance (startup · นวัตกรรม · workshop · ธุรกิจ)

const STRONG: Record<string, RegExp> = {
  startup: /start-?up|สตาร์[ทต]อัพ|ยุววิสาหกิจ/i,
  ผู้ประกอบการ: /entrepreneur|ผู้ประกอบการ|venture/i,
  ธุรกิจ: /business|ธุรกิจ|case competition|case challenge|การตลาด|marketing/i,
  นวัตกรรม: /innovat|นวัตกรรม/i,
  pitch: /pitch|ideation|ideathon/i,
  บ่มเพาะ: /incubat|accelerat|บ่มเพาะ|ted fund|ted youth/i,
}
const MEDIUM: Record<string, RegExp> = {
  workshop: /workshop|bootcamp|เวิร์[กค]ช็อป|ค่าย|\bcamp\b/i,
  hackathon: /hackathon|แฮกกาธอน/i,
  'AI/Tech': /\bai\b|digital|fintech|healthtech|deep ?tech|codex/i,
  สุขภาพ: /health|สุขภาพ|การแพทย์|medic/i,
  ความยั่งยืน: /sustainab|\besg\b|green|climate/i,
}
const OFF_TOPIC = /film|ภาพยนตร์|short film|chair design|furniture|story contest|video competition|design contest|volunteer|leadership summit|leadership institute|research showcase|โครงร่างวิจัย/i
const TYPE_BONUS: Record<string, number> = { business_case: 3, camp_workshop: 1, hackathon: 2, exchange: -2 }
export const RELEVANCE_THRESHOLD = 4

export function scoreRelevance(it: HackzaItem): { score: number; matched: string[] } {
  if (it.target_audience?.length && it.target_audience.every((a) => a === 'high_school')) return { score: -99, matched: ['ม.ปลายเท่านั้น'] }
  const title = `${it.title} ${it.organizer ?? ''}`
  const body = it.description ?? ''
  let score = TYPE_BONUS[it.type] ?? 0
  const matched: string[] = []
  for (const [k, re] of Object.entries(STRONG)) {
    if (re.test(title)) (score += 4), matched.push(k)
    else if (re.test(body)) (score += 2), matched.push(k)
  }
  for (const [k, re] of Object.entries(MEDIUM)) {
    if (re.test(title)) (score += 2), matched.push(k)
    else if (re.test(body)) (score += 1), matched.push(k)
  }
  if (OFF_TOPIC.test(it.title)) (score -= 5), matched.push('อาจไม่ตรงสาย')
  return { score, matched }
}

// ------------------------------------------------------------------ mapping → our events

const bangkokDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(iso)) : null

const AUDIENCE: Record<string, string> = { university: 'นักศึกษา', public: 'บุคคลทั่วไป', high_school: 'นักเรียน ม.ปลาย' }

export function mapToEvent(it: HackzaItem, matched: string[]) {
  const text = `${it.title} ${it.description ?? ''}`
  let category: Category = it.type === 'camp_workshop' || it.type === 'exchange' ? 'workshop' : 'competition'
  if (/incubat|accelerat|บ่มเพาะ|ยุววิสาหกิจ|ideation program/i.test(text)) category = 'incubation'
  else if (/\bgrant\b|ทุนสนับสนุน|ทุนพัฒนา|fully funded/i.test(it.title)) category = 'grant'

  const tags = new Set<Role>()
  if (/business|ธุรกิจ|case|marketing|การตลาด|pitch|entrepreneur|ผู้ประกอบการ|startup|สตาร์/i.test(text)) tags.add('business')
  if (/marketing|การตลาด|content|branding/i.test(text)) tags.add('marketing')
  if (it.type === 'hackathon' || /develop|code|software|app|codex|hackathon/i.test(text)) tags.add('developer')
  if (/\bai\b|data|machine learning|ปัญญาประดิษฐ์/i.test(text)) tags.add('data_ai')
  if (/design|ux|ui|ออกแบบ/i.test(text)) tags.add('ux_ui')
  if (/hardware|iot|robot|energy|พลังงาน/i.test(text)) tags.add('hardware')
  if (/health|การแพทย์|สุขภาพ|medic|เภสัช|แพทย์แผนไทย/i.test(text)) tags.add('domain_expert')

  const description = (it.description ?? '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim()
  const firstLine = description.split('\n').map((s) => s.trim()).find((s) => s.length > 15) ?? ''
  const summary = firstLine.length > 110 ? `${firstLine.slice(0, 107)}…` : firstLine
  const audience = (it.target_audience ?? []).map((a) => AUDIENCE[a]).filter(Boolean).join(' / ')
  const sourceUrl = `${ORIGIN}/hackathons/${it.slug}`
  return {
    title: it.title.slice(0, 120),
    category,
    organizer: it.organizer?.slice(0, 80) ?? null,
    summary: summary || null,
    benefit: it.prize_pool ? `รางวัล ${it.prize_pool}`.slice(0, 80) : it.perks?.[0]?.slice(0, 80) ?? null,
    eligibility: audience ? audience.slice(0, 40) : null,
    overview: description.replace(/\n{3,}/g, '\n\n').slice(0, 6000) || null,
    apply_url: it.registration_url || it.source_post_url || sourceUrl,
    deadline: bangkokDate(it.registration_deadline),
    deadline_at: it.registration_deadline,
    // Hackza fills event dates with the deadline when unknown — only keep real ones.
    event_start: it.event_start_date && bangkokDate(it.event_start_date) !== bangkokDate(it.registration_deadline) ? bangkokDate(it.event_start_date) : null,
    event_end: it.event_end_date && bangkokDate(it.event_end_date) !== bangkokDate(it.registration_deadline) ? bangkokDate(it.event_end_date) : null,
    location: it.location?.slice(0, 80) || null,
    format: it.format === 'online' || it.format === 'hybrid' || it.format === 'onsite' ? it.format : null,
    poster_url: it.banner_url,
    tags: [...tags],
    source: 'hackza',
    source_url: sourceUrl,
    matched,
  }
}

// ------------------------------------------------------------------ sync → event_imports (pending)

export type SyncResult = { fetched: number; relevant: number; inserted: number; updated: number; skipped: number; error?: string }

export async function syncHackza(trigger: 'cron' | 'manual' = 'cron'): Promise<SyncResult> {
  const db = adminClient()
  const { data: run } = await db.from('import_runs').insert({ source: 'hackza', trigger }).select('id').single()
  const result: SyncResult = { fetched: 0, relevant: 0, inserted: 0, updated: 0, skipped: 0 }
  try {
    const items = await fetchHackza()
    result.fetched = items.length
    const today = todayBangkok()
    const { data: existingRows } = await db.from('event_imports').select('source_id, status').eq('source', 'hackza')
    const existing = new Map((existingRows || []).map((r) => [r.source_id, r.status]))
    const now = new Date().toISOString()

    for (const it of items) {
      const { score, matched } = scoreRelevance(it)
      const mapped = mapToEvent(it, matched)
      const expired = Boolean(mapped.deadline && mapped.deadline < today)
      const status = existing.get(it.id)
      if (!status && (score < RELEVANCE_THRESHOLD || expired || it.status !== 'open')) {
        result.skipped++
        continue
      }
      if (score >= RELEVANCE_THRESHOLD) result.relevant++
      const row = {
        source: 'hackza',
        source_id: it.id,
        source_url: mapped.source_url,
        title: mapped.title,
        organizer: mapped.organizer,
        poster_url: mapped.poster_url,
        source_type: it.type,
        category: mapped.category,
        deadline: mapped.deadline,
        mapped,
        raw: it,
        relevance: score,
        matched,
        last_seen_at: now,
      }
      if (!status) {
        await db.from('event_imports').insert({ ...row, status: 'pending' })
        result.inserted++
      } else if (status === 'pending') {
        // Keep pending rows fresh; approved/rejected decisions are never overwritten.
        await db.from('event_imports').update(row).eq('source', 'hackza').eq('source_id', it.id)
        result.updated++
      } else {
        await db.from('event_imports').update({ last_seen_at: now }).eq('source', 'hackza').eq('source_id', it.id)
      }
    }
    // Pending items whose deadline passed before anyone reviewed them.
    await db.from('event_imports').update({ status: 'expired' }).eq('status', 'pending').lt('deadline', today)
  } catch (err) {
    result.error = (err as Error).message
    console.error('Hackza sync failed', err)
  }
  if (run) await db.from('import_runs').update({ ...result, finished_at: new Date().toISOString() }).eq('id', run.id)
  return result
}
