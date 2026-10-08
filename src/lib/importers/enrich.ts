import 'server-only'
import { createHash } from 'node:crypto'
import { serverEnv } from '@/lib/env'
import { thaiDates } from './text'
import type { MappedEvent } from './map'

// Fills the gaps a source left (organiser, venue, dates, prize, who can apply, closing time,
// online/onsite) by reading the listing's own description with the language model.
//
// No hallucinations: the model may only copy what the text says, and every value it returns is
// checked against the text here — anything not found word-for-word (or, for dates and times,
// not found by our own parsers) is thrown away. Filled fields are listed in mapped.ai.f so the
// admin card shows "เติมโดย AI" and the reviewer checks them before publishing.
//
// Token budget: only fields that are actually missing are asked for; only the lines that can
// hold those facts are sent (≤ 1,800 chars); a static system prompt (prefix-cacheable); JSON
// output capped at 140 tokens; results cached in mapped.ai by a hash of the text, so the same
// listing is never asked about twice; at most MAX_CALLS_PER_RUN calls per source sync.

export const MAX_CALLS_PER_RUN = 10
const MAX_TEXT = 1800

type Key = 'o' | 'l' | 's' | 'e' | 't' | 'p' | 'g' | 'f'
const FIELD: Record<Key, string> = { o: 'organizer', l: 'location', s: 'event_start', e: 'event_end', t: 'closing_time', p: 'benefit', g: 'eligibility', f: 'format' }

const SYSTEM_PROMPT = `You read ONE event listing for a Thai student-club website and copy facts out of it.
Rules:
- Use ONLY what the text states. Copy short phrases exactly as written, in the original language.
- If a field is not clearly stated, return null. Never guess, infer, translate or summarise.
- Return JSON with only the requested keys.
Keys:
o = organiser (person/organisation running it)
l = venue or city where it takes place (not a URL)
s = event start date, YYYY-MM-DD
e = event end date, YYYY-MM-DD
t = application closing time on the closing date, HH:MM 24h
p = prize or main benefit, max 60 chars
g = who may apply, max 60 chars
f = "online", "onsite" or "hybrid"`

/** What we keep in mapped.ai: text hash, accepted values, fields asked, fields filled. */
export type AiFill = { h: string; v: Partial<Record<Key, string>>; n: Key[]; f: string[] }

// ------------------------------------------------------------------ grounding checks

const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/[\s​"'“”‘’`()[\]{}·•,.:;!?\-–—_/|*#]+/g, '')

/** True when the value appears in the text (ignoring spacing/punctuation). */
function inText(value: string, text: string): boolean {
  const v = norm(value)
  return v.length >= 2 && norm(text).includes(v)
}

const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n: number) => String(n).padStart(2, '0')

/** Every date written in the text (Thai, English, ISO, d/m/y), as YYYY-MM-DD. */
export function textDates(text: string): Set<string> {
  const out = new Set(thaiDates(text))
  const year = (y: string | undefined, m: number, d: number) => {
    if (y) {
      let n = Number(y)
      if (n < 100) n += n > 50 ? 2500 : 2000
      if (n > 2400) n -= 543
      return n
    }
    const now = new Date()
    let n = now.getUTCFullYear()
    if (Date.UTC(n, m - 1, d) < now.getTime() - 60 * 86_400_000) n++
    return n
  }
  const add = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && out.add(`${y}-${pad(m)}-${pad(d)}`)
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) add(Number(m[1]), Number(m[2]), Number(m[3]))
  for (const m of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{4})?/gi)) {
    const mo = EN_MONTHS.indexOf(m[2].toLowerCase()) + 1
    add(year(m[3], mo, Number(m[1])), mo, Number(m[1]))
  }
  for (const m of text.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/gi)) {
    const mo = EN_MONTHS.indexOf(m[1].toLowerCase()) + 1
    add(year(m[3], mo, Number(m[2])), mo, Number(m[2]))
  }
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g)) add(year(m[3], Number(m[2]), Number(m[1])), Number(m[2]), Number(m[1]))
  return out
}

const CLOSING = /ปิดรับ|รับสมัคร|หมดเขต|ภายในวันที่|deadline|close|submi|register/i

/** Exported for tests: the value if the text supports it, else null. */
export function grounded(key: Key, value: string, text: string, closingDate: string | null): string | null {
  const v = value.trim().replace(/\s+/g, ' ')
  if (!v || /^(null|none|n\/a|-|ไม่ระบุ|ไม่มี)$/i.test(v)) return null
  switch (key) {
    case 'o':
    case 'l':
    case 'g':
      return v.length <= 90 && inText(v, text) ? v : null
    case 'p': {
      if (v.length > 80) return null
      if (inText(v, text)) return v
      // "รางวัลรวม 100,000 บาท" style: every number in the value must be in the text.
      const nums = v.match(/\d[\d,]{2,}/g)?.map((n) => n.replace(/,/g, ''))
      const textNums = new Set((text.match(/\d[\d,]{2,}/g) || []).map((n) => n.replace(/,/g, '')))
      return nums?.length && nums.every((n) => textNums.has(n)) ? v : null
    }
    case 's':
    case 'e':
      return /^\d{4}-\d{2}-\d{2}$/.test(v) && textDates(text).has(v) ? v : null
    case 't': {
      const m = v.match(/^(\d{1,2})[:.](\d{2})$/)
      if (!m || !closingDate || Number(m[1]) > 23 || Number(m[2]) > 59) return null
      const hh = Number(m[1]), mm = m[2]
      // The time must be written on a line that talks about closing / applying.
      const re = new RegExp(`(^|\\D)0?${hh}[:.]${mm}(\\D|$)`)
      const ok = text.split('\n').some((line) => CLOSING.test(line) && re.test(line))
      return ok ? `${pad(hh)}:${mm}` : null
    }
    case 'f': {
      const online = /ออนไลน์|online|zoom|virtual|google meet|ms teams|microsoft teams/i.test(text)
      const onsite = /ออนไซต์|onsite|on-site|ณ\s|สถานที่|venue|จัดที่|ห้องประชุม|อาคาร|มหาวิทยาลัย.{0,20}(จัด|ณ)/i.test(text)
      if (v === 'online' && online) return v
      if (v === 'onsite' && onsite) return v
      if (v === 'hybrid' && online && onsite) return v
      return null
    }
  }
}

// ------------------------------------------------------------------ what to ask, what to send

function missing(m: MappedEvent): Key[] {
  const need: Key[] = []
  if (!m.organizer) need.push('o')
  if (!m.location && m.format !== 'online') need.push('l')
  if (!m.event_start) need.push('s', 'e')
  if (m.deadline && !m.deadline_at) need.push('t')
  if (!m.benefit) need.push('p')
  if (!m.eligibility) need.push('g')
  if (!m.format) need.push('f')
  return need
}

const HINTS: Record<Key, RegExp> = {
  o: /จัดโดย|ผู้จัด|organi[sz]|hosted|presented|ร่วมกับ|โดย\s|by\s/i,
  l: /สถานที่|ณ\s|venue|location|จัดที่|ห้อง|อาคาร|จังหวัด|กรุงเทพ|bangkok|ออนไลน์|online/i,
  s: /วันที่|date|จัดขึ้น|กิจกรรม|ระหว่าง|ตั้งแต่|schedule|timeline|\d{1,2}\s*(ม\.?ค|ก\.?พ|มี\.?ค|เม\.?ย|พ\.?ค|มิ\.?ย|ก\.?ค|ส\.?ค|ก\.?ย|ต\.?ค|พ\.?ย|ธ\.?ค)/i,
  e: /วันที่|date|จัดขึ้น|ระหว่าง|ตั้งแต่|until|schedule|timeline/i,
  t: CLOSING,
  p: /รางวัล|prize|เงิน|ทุน|บาท|฿|\$|certificate|เกียรติบัตร|ฝึกงาน|intern/i,
  g: /คุณสมบัติ|ผู้สมัคร|นักศึกษา|นิสิต|นักเรียน|eligib|open to|ผู้ที่สนใจ|อายุ|ระดับ/i,
  f: /ออนไลน์|online|onsite|ออนไซต์|zoom|ณ\s|สถานที่|hybrid/i,
}

/** Only ask for a field when the text visibly has something of that kind (saves calls and tokens). */
function possible(k: Key, text: string, m: MappedEvent): boolean {
  if (k === 's' || k === 'e') return [...textDates(text)].some((d) => d !== m.deadline)
  if (k === 't') return text.split('\n').some((l) => CLOSING.test(l) && /(^|\D)\d{1,2}[:.]\d{2}(\D|$)/.test(l))
  return HINTS[k].test(text)
}

/** The first lines plus every line that may hold a requested fact — instead of the whole text. */
function excerpt(text: string, need: Key[]): string {
  const lines = text.split('\n').map((l) => l.replace(/https?:\/\/\S+/g, '').trim()).filter(Boolean)
  const keep = new Set<number>()
  lines.slice(0, 4).forEach((_, i) => keep.add(i))
  lines.forEach((l, i) => {
    if (need.some((k) => HINTS[k].test(l))) keep.add(i)
  })
  let out = ''
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (out.length + lines[i].length > MAX_TEXT) break
    out += lines[i].slice(0, 300) + '\n'
  }
  return out.trim()
}

// ------------------------------------------------------------------ model call

let pausedUntil = 0
let failures = 0

async function ask(need: Key[], m: MappedEvent, text: string): Promise<Record<string, unknown>> {
  const { openrouterKey, openrouterModel } = serverEnv()
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(12_000),
    headers: {
      Authorization: `Bearer ${openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://mahidolstartup.site',
      'X-Title': 'Mahidol Startup Club importer',
    },
    body: JSON.stringify({
      model: openrouterModel,
      temperature: 0,
      max_tokens: 140,
      reasoning: { enabled: false },
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `need=${need.join(',')}${m.deadline ? `\nclosing_date=${m.deadline}` : ''}\ntitle=${m.title}\ntext:\n${excerpt(text, need)}` },
      ],
    }),
  })
  if (!res.ok) throw new Error(`model ${res.status}: ${(await res.text()).slice(0, 120)}`)
  const body = await res.json()
  if (process.env.AI_DEBUG) console.log('[enrich] usage', JSON.stringify(body.usage))
  const content: string = body.choices?.[0]?.message?.content ?? ''
  return JSON.parse(content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1))
}

/** Shorten at a word boundary (never mid-word) and mark the cut. */
function clip(v: string, n: number) {
  if (v.length <= n) return v
  const cut = v.slice(0, n - 1)
  const at = cut.lastIndexOf(' ')
  return `${(at > n * 0.5 ? cut.slice(0, at) : cut).replace(/[\s,、]+$/, '')}…`
}

/** Writes accepted values into `m` (only empty fields) and records them in m.ai. */
function apply(m: MappedEvent & { ai?: AiFill }, fill: AiFill) {
  const filled: string[] = []
  const v = fill.v
  if (v.o && !m.organizer) (m.organizer = clip(v.o, 80)), filled.push('organizer')
  if (v.l && !m.location) (m.location = clip(v.l, 80)), filled.push('location')
  if (v.s && !m.event_start && v.s !== m.deadline) (m.event_start = v.s), filled.push('event_start')
  if (v.e && !m.event_end && v.e !== m.deadline && (!m.event_start || v.e >= m.event_start)) (m.event_end = v.e), filled.push('event_end')
  if (v.t && m.deadline && !m.deadline_at) (m.deadline_at = `${m.deadline}T${v.t}:00+07:00`), filled.push('deadline_at')
  if (v.p && !m.benefit) (m.benefit = clip(v.p, 80)), filled.push('benefit')
  if (v.g && !m.eligibility) (m.eligibility = clip(v.g, 60)), filled.push('eligibility')
  if (v.f && !m.format) (m.format = v.f as MappedEvent['format']), filled.push('format')
  m.ai = { ...fill, f: filled }
}

/**
 * Fill missing fields of one mapped listing. `cached` = mapped.ai from the stored row (if any).
 * Returns true when a model call was made (for the per-run budget).
 */
export async function fillGaps(m: MappedEvent & { ai?: AiFill }, cached: AiFill | null | undefined, allowCall: boolean): Promise<boolean> {
  const text = `${m.title}\n${m.overview ?? ''}`
  const need = missing(m).filter((k) => possible(k, m.overview ?? '', m))
  if (!need.length || (m.overview ?? '').length < 80) return false
  const h = createHash('sha1').update(text).digest('hex').slice(0, 16)
  // Same text as last time: reuse the checked answers, no call.
  if (cached?.h === h && need.every((k) => cached.n.includes(k))) {
    apply(m, cached)
    return false
  }
  const { openrouterKey } = serverEnv()
  if (!allowCall || !openrouterKey || Date.now() < pausedUntil) return false
  try {
    const raw = await ask(need, m, text)
    failures = 0
    const v: Partial<Record<Key, string>> = {}
    for (const k of need) {
      const val = raw[k]
      if (typeof val !== 'string') continue
      const ok = grounded(k, val, text, m.deadline)
      if (ok) v[k] = ok
      else if (process.env.AI_DEBUG) console.log(`[enrich] rejected ${FIELD[k]}=${JSON.stringify(val)} (not in text) — ${m.title.slice(0, 40)}`)
    }
    apply(m, { h, v, n: need, f: [] })
  } catch (err) {
    if (++failures >= 2) (pausedUntil = Date.now() + 5 * 60_000), (failures = 0)
    console.error('enrich failed', m.title.slice(0, 40), (err as Error).message)
  }
  return true
}
