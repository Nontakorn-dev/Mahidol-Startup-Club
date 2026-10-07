import 'server-only'
import { z } from 'zod'
import { serverEnv } from '@/lib/env'
import { adminClient } from '@/lib/supabase/admin'
import { todayBangkok } from '@/lib/format'
import {
  CATEGORIES,
  CATEGORY_KEYS,
  ROLES,
  ROLE_KEYS,
  TRACKS,
  TRACK_KEYS,
  type Category,
  type Role,
  type Track,
} from '@/lib/constants'

// Pipeline (see design/Pipeline.html):
//   user text → DeepSeek (JSON only, values restricted to our vocab) → query builder in Postgres
// The LLM never searches; it only translates the sentence into filters.

export const TARGETS = ['events', 'teams', 'people', 'cofounder'] as const
export type Target = (typeof TARGETS)[number]

export type Intent = {
  targets: Target[]
  event_slug: string | null
  categories: Category[]
  my_skills: Role[]
  roles_needed: Role[]
  cofounder_seeking: Track[]
  keywords: string[]
  deadline_from: string | null
  deadline_to: string | null
  include_closed: boolean
  summary: string
  confidence: number
}

export const EMPTY_INTENT: Intent = {
  targets: ['events', 'teams', 'people'],
  event_slug: null,
  categories: [],
  my_skills: [],
  roles_needed: [],
  cofounder_seeking: [],
  keywords: [],
  deadline_from: null,
  deadline_to: null,
  include_closed: false,
  summary: '',
  confidence: 0,
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null)
const enumArr = <T extends string>(values: readonly T[]) =>
  z
    .array(z.string())
    .catch([])
    .transform((arr) => [...new Set(arr.filter((v): v is T => (values as readonly string[]).includes(v)))])

function intentSchema(eventSlugs: string[]) {
  return z.object({
    targets: enumArr(TARGETS).transform((t) => (t.length ? t : (['events', 'teams', 'people'] as Target[]))),
    event_slug: z
      .string()
      .nullable()
      .catch(null)
      .transform((s) => (s && eventSlugs.includes(s) ? s : null)),
    categories: enumArr(CATEGORY_KEYS),
    my_skills: enumArr(ROLE_KEYS),
    roles_needed: enumArr(ROLE_KEYS),
    cofounder_seeking: enumArr(TRACK_KEYS),
    keywords: z
      .array(z.string())
      .catch([])
      .transform((k) => k.map((s) => s.trim()).filter((s) => s.length > 1).slice(0, 6)),
    deadline_from: dateStr,
    deadline_to: dateStr,
    include_closed: z.boolean().catch(false),
    summary: z.string().catch('').transform((s) => s.slice(0, 160)),
    confidence: z.number().min(0).max(1).catch(0.5),
  })
}

export function normalizeQuery(q: string) {
  return q.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 300)
}

type EventOption = { slug: string; title: string; category: string; closed: boolean }

function systemPrompt(events: EventOption[]) {
  const today = todayBangkok()
  return `คุณคือตัวแปลงความต้องการ (intent parser) ของเว็บ Mahidol Startup Club ช่วยนักศึกษาหางานแข่ง ทุน ทีม และ co-founder
หน้าที่: แปลงประโยคของผู้ใช้ (ไทย/อังกฤษปนกันได้) เป็น JSON ตัวกรองเท่านั้น ห้ามตอบอย่างอื่น
วันนี้คือ ${today} (เวลาไทย)

ค่าที่อนุญาต — ต้องเลือกจากรายการนี้เท่านั้น ห้ามคิดค่าใหม่:
- targets (สิ่งที่ผู้ใช้อยากเห็น เรียงจากสำคัญสุด): "events" (งานแข่ง/ทุน/โครงการ), "teams" (ทีมที่กำลังหาคน — ใช้เมื่อผู้ใช้อยากเข้าร่วมทีม), "people" (คนที่กำลังหาทีม — ใช้เมื่อผู้ใช้มีทีมแล้ว/ขาดคน/อยากชวนคนเข้าทีม), "cofounder" (คนร่วมก่อตั้งสตาร์ตอัพ)
- event_slug: slug ของงานที่ผู้ใช้พูดถึง หรือ null
${events.map((e) => `  • ${e.slug} = ${e.title} [${e.category}]${e.closed ? ' (ปิดรับแล้ว)' : ''}`).join('\n')}
- categories: ${CATEGORY_KEYS.map((k) => `"${k}" (${CATEGORIES[k]})`).join(', ')}
- my_skills / roles_needed: ${ROLE_KEYS.map((k) => `"${k}" (${ROLES[k]})`).join(', ')}
  (dev/โปรแกรมเมอร์/coder/full-stack/frontend/backend → developer; UX/UI/designer/ออกแบบ → ux_ui; ธุรกิจ/pitch/finance/sales → business; การตลาด/content/graphic → marketing; data/AI/ML → data_ai; IoT/electronics → hardware; หมอ/เภสัช/แพทย์/ผู้เชี่ยวชาญ → domain_expert)
- cofounder_seeking: ${TRACK_KEYS.map((k) => `"${k}" (${TRACKS[k]})`).join(', ')}
- keywords: คำสำคัญอิสระ ≤ 6 คำ เช่น สาย HealthTech, EdTech, hackathon (ไม่ต้องใส่คำที่แปลงเป็นตัวกรองแล้ว)
- deadline_from / deadline_to: YYYY-MM-DD หรือ null — แปลงคำเวลาแบบไทย ปฏิทินมหิดล: เทอม 1 = ส.ค.–ธ.ค., เทอม 2 = ม.ค.–พ.ค., ปิดเทอมใหญ่ = มิ.ย.–ก.ค., ปิดเทอมเล็ก = กลาง ธ.ค.–ต้น ม.ค. "เดือนนี้" "สัปดาห์หน้า" ฯลฯ ให้คำนวณจากวันนี้
- include_closed: true เฉพาะเมื่อผู้ใช้อยากดูงานที่ปิดรับแล้ว
- summary: สรุปสั้นภาษาไทย ≤ 80 ตัวอักษร ว่าผู้ใช้กำลังหาอะไร
- confidence: 0–1 ความมั่นใจในการแปลง

กฎ: my_skills = สิ่งที่ผู้ใช้ทำได้เอง, roles_needed = ตำแหน่งที่ผู้ใช้ขาด/อยากได้เพิ่ม
ตอบเป็น JSON object ที่มีครบทุก key ข้างต้นเท่านั้น`
}

async function callDeepSeek(query: string, events: EventOption[]): Promise<unknown> {
  const { openrouterKey, openrouterModel } = serverEnv()
  if (!openrouterKey) throw new Error('OPENROUTER_API_KEY missing')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://mahidol-startup-club.vercel.app',
        'X-Title': 'Mahidol Startup Club',
      },
      body: JSON.stringify({
        model: openrouterModel,
        temperature: 0,
        reasoning: { enabled: false },
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(events) },
          { role: 'user', content: query },
        ],
      }),
    })
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const body = await res.json()
    const content: string = body.choices?.[0]?.message?.content ?? ''
    const json = content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1)
    return JSON.parse(json)
  } finally {
    clearTimeout(timer)
  }
}

async function eventOptions(): Promise<EventOption[]> {
  const today = todayBangkok()
  const { data } = await adminClient()
    .from('events')
    .select('slug, title, category, deadline')
    .eq('status', 'published')
    .limit(80)
  return (data || []).map((e) => ({
    slug: e.slug,
    title: e.title,
    category: e.category,
    closed: Boolean(e.deadline && e.deadline < today),
  }))
}

// ------------------------------------------------------------------ fallback

const ROLE_SYNONYMS: Record<Role, RegExp> = {
  developer: /dev|โปรแกรม|coder|code|full.?stack|front.?end|back.?end|engineer|react|flutter|นักพัฒนา/i,
  ux_ui: /ux|ui|design|ดีไซน์|ออกแบบ|figma/i,
  business: /business|ธุรกิจ|pitch|finance|การเงิน|sales|ขาย|bd\b/i,
  marketing: /market|การตลาด|content|คอนเทนต์|graphic|กราฟิก|social/i,
  data_ai: /data|ai\b|ml\b|machine learning|ข้อมูล|ปัญญาประดิษฐ์/i,
  hardware: /hardware|iot|ฮาร์ดแวร์|อิเล็ก|robot|หุ่นยนต์/i,
  domain_expert: /แพทย์|หมอ|เภสัช|พยาบาล|domain|ผู้เชี่ยวชาญ|medical|clinic/i,
}

const CATEGORY_SYNONYMS: Record<Category, RegExp> = {
  grant: /ทุน|grant|fund/i,
  team_recruit: /รับสมัครทีม|core team|รับสมัครคน/i,
  competition: /แข่ง|compet|hackathon|แฮกกาธอน|pitching/i,
  incubation: /บ่มเพาะ|incubat|accelerat/i,
  workshop: /workshop|เวิร์กช็อป|กิจกรรม|อบรม/i,
}

/** Keyword-only parse used when the LLM is unavailable or unsure. */
export function ruleBasedIntent(query: string, events: EventOption[]): Intent {
  const q = query.toLowerCase()
  const intent: Intent = { ...EMPTY_INTENT, targets: [], summary: query.slice(0, 80), confidence: 0.3 }
  const lackIdx = q.search(/ขาด|หา|อยากได้|ต้องการ|need|looking for/)
  for (const role of ROLE_KEYS) {
    const m = q.match(ROLE_SYNONYMS[role])
    if (!m) continue
    const idx = q.indexOf(m[0].toLowerCase())
    if (lackIdx >= 0 && idx > lackIdx && /ขาด|อยากได้|need/.test(q)) intent.roles_needed.push(role)
    else intent.my_skills.push(role)
  }
  for (const c of CATEGORY_KEYS) if (CATEGORY_SYNONYMS[c].test(q)) intent.categories.push(c)
  const words = q.split(/\s+/).filter((w) => w.length > 2)
  const event = events.find((e) => {
    const t = e.title.toLowerCase()
    return t.split(/\s+/).filter((w) => w.length > 3 && !/mahidol|2026|2569/.test(w)).some((w) => q.includes(w))
  })
  if (event) intent.event_slug = event.slug
  if (/co.?founder|โคฟาวเดอร์|ร่วมก่อตั้ง/.test(q)) intent.targets.push('cofounder')
  if (/ทีม|team/.test(q)) intent.targets.push(intent.roles_needed.length ? 'people' : 'teams')
  if (/คน|เพื่อน|ขาด/.test(q) && !intent.targets.includes('people')) intent.targets.push('people')
  intent.targets.unshift('events')
  intent.targets = [...new Set(intent.targets)]
  intent.keywords = words
    .filter((w) => !Object.values(ROLE_SYNONYMS).some((r) => r.test(w)) && !/หา|อยาก|ทีม|ลง|ฉัน|ได้|ขาด/.test(w))
    .slice(0, 4)
  return intent
}

// ------------------------------------------------------------------ main

export type ParseResult = { intent: Intent; usedFallback: boolean; cached: boolean }

export async function parseIntent(query: string): Promise<ParseResult> {
  const events = await eventOptions()
  const key = `${normalizeQuery(query)}|${todayBangkok()}`
  const db = adminClient()

  const { data: hit } = await db.from('search_cache').select('parsed').eq('normalized_query', key).maybeSingle()
  if (hit?.parsed) {
    const parsed = intentSchema(events.map((e) => e.slug)).safeParse(hit.parsed)
    if (parsed.success) return { intent: parsed.data, usedFallback: false, cached: true }
  }

  try {
    const raw = await callDeepSeek(query, events)
    const parsed = intentSchema(events.map((e) => e.slug)).parse(raw)
    if (parsed.confidence < 0.35) {
      // Low confidence: merge with keyword parse so we still show something useful.
      const rb = ruleBasedIntent(query, events)
      return {
        intent: { ...parsed, keywords: [...new Set([...parsed.keywords, ...rb.keywords])].slice(0, 6) },
        usedFallback: true,
        cached: false,
      }
    }
    await db.from('search_cache').upsert({ normalized_query: key, parsed })
    return { intent: parsed, usedFallback: false, cached: false }
  } catch (err) {
    console.error('intent parse failed, using fallback', err)
    return { intent: ruleBasedIntent(query, events), usedFallback: true, cached: false }
  }
}

/** Ask DeepSeek for short "แนะนำเพราะ…" reasons for already-ranked results. */
export async function explainMatches(
  query: string,
  items: { key: string; text: string }[],
): Promise<Record<string, string>> {
  const { openrouterKey, openrouterModel } = serverEnv()
  if (!openrouterKey || !items.length) return {}
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: openrouterModel,
      temperature: 0.2,
      reasoning: { enabled: false },
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'เขียนเหตุผลสั้นๆ ภาษาไทย (≤ 60 ตัวอักษร, น้ำเสียงเป็นกันเอง) ว่าทำไมแต่ละรายการตรงกับสิ่งที่ผู้ใช้ค้นหา ห้ามแต่งข้อมูลที่ไม่มีในรายการ ตอบเป็น JSON {"<key>": "<เหตุผล>"} ครบทุก key',
        },
        {
          role: 'user',
          content: `คำค้น: ${query}\n\nรายการ:\n${items.map((i) => `${i.key}: ${i.text}`).join('\n')}`,
        },
      ],
    }),
  })
  if (!res.ok) return {}
  try {
    const body = await res.json()
    const content: string = body.choices?.[0]?.message?.content ?? '{}'
    const obj = JSON.parse(content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1))
    const out: Record<string, string> = {}
    for (const i of items) if (typeof obj[i.key] === 'string') out[i.key] = obj[i.key].slice(0, 120)
    return out
  } catch {
    return {}
  }
}

/** Encode/decode an edited intent in the URL so chip edits never re-call the LLM. */
export function encodeIntent(i: Intent) {
  return Buffer.from(JSON.stringify(i)).toString('base64url')
}

export async function decodeIntent(s: string): Promise<Intent | null> {
  try {
    const events = await eventOptions()
    const parsed = intentSchema(events.map((e) => e.slug)).safeParse(JSON.parse(Buffer.from(s, 'base64url').toString('utf8')))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
