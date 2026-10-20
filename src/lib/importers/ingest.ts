import 'server-only'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { todayBangkok } from '@/lib/format'
import { CATEGORY_KEYS, ROLE_KEYS, type Category, type Role } from '@/lib/constants'
import { mapToEvent, type MappedEvent } from './map'
import { scoreRelevance } from './relevance'
import { normalUrl, pageKey, sameOpportunity } from './text'
import type { Level, SourceItem } from './types'

// Opportunities pushed to POST /api/imports (a daily ChatGPT search) → event_imports.
// Nothing is ever published automatically:
//   new                         → pending    (admin approves / rejects)
//   same event already known    → duplicate  (of another source's import or an existing event)
//   closed / ม.ปลาย only        → skipped    (admin can still rescue it)
// Sending a listing again (same source_url, or same apply link / title + nearby deadline)
// updates it. Approved / rejected decisions are never overwritten — only their snapshot is
// refreshed, and an approved listing whose closing date moved is flagged for the admin.

export const INGEST_SOURCE = 'chatgpt'
export const MAX_ITEMS = 50
export const LEVELS = ['university', 'public', 'high_school'] as const
export const FORMATS = ['online', 'onsite', 'hybrid'] as const

/** Display names for event_imports.source (older rows came from the retired site scrapers). */
export const SOURCE_NAMES: Record<string, string> = {
  chatgpt: 'ChatGPT',
  hackza: 'Hackza',
  contester: 'Contester.Life',
  camphub: 'CAMPHUB',
  dekport: 'DekPort',
  devpost: 'Devpost',
  manual: 'เพิ่มเอง',
}
export const sourceName = (key: string) => SOURCE_NAMES[key] ?? key

// ------------------------------------------------------------------ request body

const url = z.httpUrl().max(2000)
/** Long text is cut to size rather than rejected — a long description shouldn't lose the listing. */
const text = (max: number) => z.string().trim().min(1).transform((s) => s.slice(0, max))
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'ต้องเป็น YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'วันที่ไม่ถูกต้อง')

const REQUIRED = z.object({ title: text(200), source_url: url })

/** Optional fields: an invalid one is dropped (reported as a warning), the listing still goes in. */
const OPTIONAL = {
  apply_url: url,
  organizer: text(120),
  category: z.enum(CATEGORY_KEYS as [Category, ...Category[]]),
  summary: text(300),
  description: text(8000),
  deadline: isoDate,
  deadline_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'ต้องเป็น HH:MM (24 ชม.)'),
  event_start: isoDate,
  event_end: isoDate,
  location: text(120),
  format: z.enum(FORMATS),
  prize: text(200),
  eligibility: text(200),
  levels: z.array(z.enum(LEVELS)).max(3),
  poster_url: url,
  tags: z.array(z.enum(ROLE_KEYS as [Role, ...Role[]])).max(7),
  evidence: z.array(url).max(5),
  confidence: z.number().min(0).max(1),
  notes: text(1000),
  source_name: text(60),
} as const

type Optional = { [K in keyof typeof OPTIONAL]?: z.output<(typeof OPTIONAL)[K]> }
export type IngestItem = z.output<typeof REQUIRED> & Optional

export const BatchSchema = z.object({
  run_id: z.string().trim().max(64).optional(),
  items: z.array(z.unknown()).min(1, 'items ต้องมีอย่างน้อย 1 รายการ').max(MAX_ITEMS, `ส่งได้ไม่เกิน ${MAX_ITEMS} รายการต่อครั้ง`),
})

const issueText = (e: z.ZodError) => e.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`).join('; ')

export function parseItem(raw: unknown): { item: IngestItem; warnings: string[] } | { errors: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { errors: 'แต่ละรายการต้องเป็น JSON object' }
  const obj = raw as Record<string, unknown>
  const base = REQUIRED.safeParse(obj)
  if (!base.success) return { errors: issueText(base.error) }
  const item: IngestItem = { ...base.data }
  const warnings: string[] = []
  for (const [key, schema] of Object.entries(OPTIONAL)) {
    const v = obj[key]
    if (v === undefined || v === null || v === '') continue
    const r = (schema as z.ZodType).safeParse(v)
    if (r.success) (item as Record<string, unknown>)[key] = r.data
    else warnings.push(`${key} ถูกละไว้ (${issueText(r.error)})`)
  }
  if (item.event_start && item.event_end && item.event_end < item.event_start) {
    delete (item as { event_end?: string }).event_end
    warnings.push('event_end ถูกละไว้ (ก่อน event_start)')
  }
  return { item, warnings }
}

// ------------------------------------------------------------------ mapping

/** One key per listing page: tracking params and trailing slashes don't make a new listing. */
const listingKey = (u: string) => normalUrl(u) ?? pageKey(u) ?? u.toLowerCase()

export type ChatgptMeta = { evidence: string[]; confidence: number | null; notes: string | null; source_name: string | null }
export type IngestMapped = MappedEvent & { chatgpt: ChatgptMeta }

function toListing(item: IngestItem, runId: string | null) {
  const deadline_at = item.deadline ? new Date(`${item.deadline}T${item.deadline_time ?? '23:59'}:00+07:00`).toISOString() : null
  let host = ''
  try {
    host = new URL(item.source_url).hostname.replace(/^www\./, '')
  } catch {}
  const it: SourceItem = {
    source_id: listingKey(item.source_url),
    source_url: item.source_url,
    source_type: item.source_name ?? host,
    title: item.title,
    organizer: item.organizer ?? null,
    description: item.description ?? null,
    poster_url: item.poster_url ?? null,
    apply_url: item.apply_url ?? null,
    deadline_at,
    deadline: item.deadline ?? null,
    event_start: item.event_start ?? null,
    event_end: item.event_end ?? null,
    location: item.location ?? null,
    format: item.format ?? null,
    prize: item.prize ?? null,
    eligibility: item.eligibility ?? null,
    levels: (item.levels ?? []) as Level[],
    open: true,
    raw: { run_id: runId, received_at: new Date().toISOString(), data: item },
  }
  const { score, matched, levels } = scoreRelevance(it)
  const base = mapToEvent(INGEST_SOURCE, it, matched, levels)
  // What ChatGPT states explicitly wins over the keyword guesses in mapToEvent().
  const mapped: IngestMapped = {
    ...base,
    category: item.category ?? base.category,
    tags: item.tags?.length ? [...new Set(item.tags)] : base.tags,
    summary: item.summary ? (item.summary.length > 120 ? `${item.summary.slice(0, 117)}…` : item.summary) : base.summary,
    // Date only → no exact moment; the events trigger closes it at 23:59 Bangkok time.
    deadline_at: item.deadline_time ? deadline_at : null,
    chatgpt: { evidence: item.evidence ?? [], confidence: item.confidence ?? null, notes: item.notes ?? null, source_name: item.source_name ?? null },
  }

  const today = todayBangkok()
  let reason: string | null = null
  if (item.deadline && item.deadline < today) reason = 'เลยวันปิดรับแล้ว'
  else if (deadline_at && Date.parse(deadline_at) <= Date.now()) reason = 'ปิดรับสมัครแล้ว'
  else if (score === -99) reason = 'รับเฉพาะนักเรียน ม.ปลาย'

  const flags: string[] = []
  if (!item.deadline) flags.push('no_deadline')
  else if (!item.deadline_time) flags.push('date_only')
  if (!item.apply_url || normalUrl(item.apply_url) === normalUrl(item.source_url)) flags.push('no_official_link')
  if (!mapped.overview) flags.push('no_description')
  if (!item.evidence?.length) flags.push('no_evidence')
  if (item.confidence !== undefined && item.confidence < 0.6) flags.push('low_confidence')

  const row = {
    source: INGEST_SOURCE,
    source_id: it.source_id,
    source_url: it.source_url,
    title: mapped.title,
    organizer: mapped.organizer,
    poster_url: mapped.poster_url,
    source_type: it.source_type || 'web',
    category: mapped.category,
    deadline: it.deadline,
    deadline_at: mapped.deadline_at,
    mapped,
    raw: it.raw,
    relevance: score,
    matched,
    levels,
    flags,
    skip_reason: reason,
  }
  return { it, row, reason, closed: reason === 'เลยวันปิดรับแล้ว' || reason === 'ปิดรับสมัครแล้ว' }
}

// ------------------------------------------------------------------ duplicates

type IndexEntry = { importId?: string; eventId?: string; source: string; sourceId?: string; title: string; deadline: string | null; apply: string | null; sourceUrl?: string | null }
type Known = { id: string; source_id: string; status: string; reviewed: boolean; title: string; deadline: string | null; apply: string | null; event_id: string | null }

/** Everything a new listing could be "the same event" as: other sources' imports and existing events. */
async function duplicateIndex(): Promise<IndexEntry[]> {
  const db = adminClient()
  const [{ data: imports }, { data: events }] = await Promise.all([
    db.from('event_imports').select('id, source, source_id, title, deadline, event_id, apply:mapped->>apply_url').neq('source', INGEST_SOURCE).in('status', ['pending', 'approved', 'rejected']),
    db.from('events').select('id, title, deadline, apply_url, source, source_url'),
  ])
  const linked = new Set((imports || []).map((i) => i.event_id).filter(Boolean))
  return [
    ...(imports || []).map((i) => ({ importId: i.id, source: i.source, sourceId: i.source_id, title: i.title, deadline: i.deadline, apply: normalUrl(i.apply as string | null) })),
    // Events not created from another source's import (curated, hand-made, or approved from here).
    ...(events || []).filter((e) => !linked.has(e.id)).map((e) => ({ eventId: e.id, source: e.source ?? 'manual', title: e.title, deadline: e.deadline, apply: normalUrl(e.apply_url), sourceUrl: e.source_url as string | null })),
  ]
}

function findDuplicate(index: IndexEntry[], it: SourceItem, ownEventId: string | null): IndexEntry | null {
  const apply = it.apply_url && it.apply_url !== it.source_url ? normalUrl(it.apply_url) : null
  const ownPage = pageKey(it.source_url)
  for (const e of index) {
    if (ownEventId && e.eventId === ownEventId) continue // the event this listing was approved into
    if (ownPage && e.sourceUrl && pageKey(e.sourceUrl) === ownPage) return e
    if (apply && e.apply && apply === e.apply) return e
    if (sameOpportunity({ title: it.title, deadline: it.deadline }, e)) return e
  }
  return null
}

/** A listing ChatGPT already sent — by page, else by apply link or title + nearby deadline. */
function findKnown(known: Known[], it: SourceItem): Known | null {
  const byKey = known.find((k) => k.source_id === it.source_id)
  if (byKey) return byKey
  const apply = it.apply_url ? normalUrl(it.apply_url) : null
  return known.find((k) => (apply && k.apply === apply) || sameOpportunity({ title: it.title, deadline: it.deadline }, k)) ?? null
}

// ------------------------------------------------------------------ what we already have

export type KnownStatus = 'published' | 'in_review' | 'rejected'
export type KnownListing = { title: string; status: KnownStatus; deadline: string | null; source_url: string | null; apply_url: string | null }

/**
 * Everything still open that the feed needn't look for again: events on the site (published, or a
 * draft an admin is editing) and listings waiting in / turned away from the review queue.
 * Closed ones are left out (the feed only sends open opportunities), and so are auto-skipped rows:
 * the retired scrapers' keyword filter skipped some good listings the feed should still find.
 */
export async function listKnown(): Promise<KnownListing[]> {
  const db = adminClient()
  const today = todayBangkok()
  const [{ data: events }, { data: imports }] = await Promise.all([
    db.from('events').select('title, status, deadline, source_url, apply_url').or(`deadline.is.null,deadline.gte.${today}`),
    db
      .from('event_imports')
      .select('title, status, deadline, source_url, apply:mapped->>apply_url')
      .in('status', ['pending', 'duplicate', 'rejected'])
      .or(`deadline.is.null,deadline.gte.${today}`),
  ])
  const IMPORT_STATUS: Record<string, KnownStatus> = { pending: 'in_review', duplicate: 'in_review', rejected: 'rejected' }
  return [
    ...(events || []).map((e) => ({ title: e.title, status: (e.status === 'published' ? 'published' : 'in_review') as KnownStatus, deadline: e.deadline, source_url: e.source_url, apply_url: e.apply_url })),
    ...(imports || []).map((i) => ({ title: i.title, status: IMPORT_STATUS[i.status], deadline: i.deadline, source_url: i.source_url, apply_url: (i.apply as string | null) ?? null })),
  ]
}

// ------------------------------------------------------------------ ingest

export type ItemResult = {
  index: number
  status: 'inserted' | 'duplicate' | 'updated' | 'skipped' | 'invalid'
  id?: string
  reason?: string
  warnings?: string[]
}
export type IngestSummary = Record<ItemResult['status'], number>

export async function ingestBatch(rawItems: unknown[], runId: string | null): Promise<{ results: ItemResult[]; summary: IngestSummary }> {
  const db = adminClient()
  const { data: run } = await db.from('import_runs').insert({ source: INGEST_SOURCE, trigger: 'api' }).select('id').single()
  const summary: IngestSummary = { inserted: 0, duplicate: 0, updated: 0, skipped: 0, invalid: 0 }
  const results: ItemResult[] = []
  let error: string | null = null

  try {
    const { data: knownRows } = await db
      .from('event_imports')
      .select('id, source_id, status, reviewed_at, title, deadline, event_id, apply:mapped->>apply_url')
      .eq('source', INGEST_SOURCE)
    const known: Known[] = (knownRows || []).map((r) => ({
      id: r.id,
      source_id: r.source_id,
      status: r.status,
      reviewed: Boolean(r.reviewed_at),
      title: r.title,
      deadline: r.deadline,
      apply: normalUrl(r.apply as string | null),
      event_id: r.event_id,
    }))
    const index = await duplicateIndex()
    const now = new Date().toISOString()

    for (const [i, raw] of rawItems.entries()) {
      const parsed = parseItem(raw)
      if ('errors' in parsed) {
        results.push({ index: i, status: 'invalid', reason: parsed.errors })
        summary.invalid++
        continue
      }
      const warnings = parsed.warnings.length ? parsed.warnings : undefined
      const { it, row, reason, closed } = toListing(parsed.item, runId)
      const prev = findKnown(known, it)
      const placement = () => {
        const dup = findDuplicate(index, it, prev?.event_id ?? null)
        return dup
          ? { status: 'duplicate', duplicate_of: dup.importId ?? null, duplicate_event_id: dup.eventId ?? null }
          : { status: 'pending', duplicate_of: null, duplicate_event_id: null }
      }

      if (!prev) {
        const place = reason ? { status: 'skipped' } : placement()
        const { data: ins, error: insErr } = await db.from('event_imports').insert({ ...row, ...place, last_seen_at: now }).select('id').single()
        if (insErr || !ins) {
          results.push({ index: i, status: 'invalid', reason: `บันทึกไม่สำเร็จ: ${insErr?.message}`, warnings })
          summary.invalid++
          continue
        }
        known.push({ id: ins.id, source_id: it.source_id, status: place.status, reviewed: false, title: it.title, deadline: it.deadline, apply: normalUrl(it.apply_url), event_id: null })
        const status = place.status === 'skipped' ? 'skipped' : place.status === 'duplicate' ? 'duplicate' : 'inserted'
        results.push({ index: i, status, id: ins.id, reason: reason ?? (status === 'duplicate' ? 'มีงานนี้ในระบบแล้ว' : undefined), warnings })
        summary[status]++
        continue
      }

      // Seen before: refresh it. Keep the original listing key so the row stays findable by it.
      const fresh = { ...row, source_id: prev.source_id, last_seen_at: now }
      let patch: Record<string, unknown>
      let note: string | undefined
      if (prev.status === 'approved' || prev.status === 'rejected') {
        const flags = [...row.flags]
        if (prev.status === 'approved' && prev.event_id) {
          const { data: ev } = await db.from('events').select('deadline').eq('id', prev.event_id).maybeSingle()
          if (ev && it.deadline && ev.deadline !== it.deadline) {
            flags.push(`deadline_changed:${it.deadline}`)
            note = `งานนี้เผยแพร่แล้ว — วันปิดรับใหม่ (${it.deadline}) ไม่ตรงกับบนเว็บ (${ev.deadline ?? 'ไม่ระบุ'}) แอดมินจะเห็นแจ้งเตือน`
          }
        }
        patch = { raw: row.raw, mapped: row.mapped, flags, last_seen_at: now } // decision stays
        note ??= prev.status === 'approved' ? 'อนุมัติไปแล้ว — อัปเดตข้อมูลอ้างอิงเท่านั้น' : 'แอดมินเคยเลือก “ไม่เอา” — อัปเดตข้อมูลอ้างอิงเท่านั้น'
      } else if (closed) {
        patch = { ...fresh, status: prev.status === 'skipped' ? 'skipped' : 'expired' }
        note = reason ?? undefined
      } else if (prev.status === 'pending' && prev.reviewed) {
        patch = fresh // admin moved it back to the queue ("not a duplicate") — keep it there
      } else if (reason) {
        patch = { ...fresh, status: 'skipped' }
        note = reason
      } else {
        patch = { ...fresh, ...placement() }
      }
      await db.from('event_imports').update(patch).eq('id', prev.id)
      Object.assign(prev, { status: (patch.status as string | undefined) ?? prev.status, title: it.title, deadline: it.deadline, apply: normalUrl(it.apply_url) })
      results.push({ index: i, status: 'updated', id: prev.id, reason: note, warnings })
      summary.updated++
    }

    // Queue hygiene (every source): closing dates that passed before anyone reviewed them.
    await db.from('event_imports').update({ status: 'expired' }).in('status', ['pending', 'duplicate']).lt('deadline', todayBangkok())
  } catch (err) {
    error = (err as Error).message
    console.error('imports ingest failed', err)
  }

  if (run) {
    await db
      .from('import_runs')
      .update({
        fetched: rawItems.length,
        relevant: summary.inserted + summary.duplicate + summary.updated,
        inserted: summary.inserted,
        updated: summary.updated,
        skipped: summary.skipped + summary.invalid,
        duplicates: summary.duplicate,
        error,
        finished_at: new Date().toISOString(),
      })
      .eq('id', run.id)
  }
  if (error) throw new Error(error)
  return { results, summary }
}
