import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { todayBangkok } from '@/lib/format'
import { resetRobots } from './http'
import { fillGaps, MAX_CALLS_PER_RUN, type AiFill } from './enrich'
import { mapToEvent } from './map'
import { scoreRelevance, skipReason } from './relevance'
import { normalUrl, pageKey, sameOpportunity } from './text'
import type { KnownRow, Source, SourceItem } from './types'
import { hackza } from './sources/hackza'
import { contester } from './sources/contester'
import { camphub } from './sources/camphub'
import { dekport } from './sources/dekport'
import { devpost } from './sources/devpost'

// Every source → event_imports. Nothing is ever published automatically:
//   relevant & new            → pending    (admin approves / rejects)
//   same event on another site→ duplicate  (kept for cross-checking, hidden from the queue)
//   off-topic / closed / ม.ปลาย → skipped  (remembered so it isn't re-fetched; admin can rescue)
// Approved / rejected decisions are never overwritten — only their snapshot is refreshed.

export const SOURCES: Source[] = [hackza, contester, camphub, dekport, devpost]
export const SOURCE_BY_KEY = Object.fromEntries(SOURCES.map((s) => [s.key, s])) as Record<string, Source>

export type SyncResult = {
  source: string
  fetched: number
  relevant: number
  inserted: number
  updated: number
  skipped: number
  duplicates: number
  error?: string
}

const HOUR = 3_600_000
/** A source is due ~6 h after its last good run (hourly trigger, so 5.5 h keeps the rhythm). */
const DUE_AFTER = 5.5 * HOUR
const RETRY_AFTER_ERROR = 1 * HOUR
/** A site that refuses us (403/429/challenge/robots) is left alone longer each time: 6 h, 12 h, then daily. */
const BLOCKED = /responded (403|429|503)|bot challenge|robots\.txt disallows/
const blockedWait = (times: number) => Math.min(24, 6 * 2 ** Math.max(0, times - 1)) * HOUR
export const MANUAL_COOLDOWN_MS = 10 * 60_000

type IndexEntry = { importId?: string; eventId?: string; source: string; sourceId?: string; title: string; deadline: string | null; apply: string | null; sourceUrl?: string | null }

async function duplicateIndex(): Promise<IndexEntry[]> {
  const db = adminClient()
  const [{ data: imports }, { data: events }] = await Promise.all([
    db.from('event_imports').select('id, source, source_id, title, deadline, event_id, apply:mapped->>apply_url').in('status', ['pending', 'approved', 'rejected']),
    db.from('events').select('id, title, deadline, apply_url, source, source_url'),
  ])
  const linked = new Set((imports || []).map((i) => i.event_id).filter(Boolean))
  return [
    ...(imports || []).map((i) => ({ importId: i.id, source: i.source, sourceId: i.source_id, title: i.title, deadline: i.deadline, apply: normalUrl(i.apply as string | null) })),
    // Events not created from an import (curated / hand-made).
    ...(events || []).filter((e) => !linked.has(e.id)).map((e) => ({ eventId: e.id, source: e.source ?? 'manual', title: e.title, deadline: e.deadline, apply: normalUrl(e.apply_url), sourceUrl: e.source_url as string | null })),
  ]
}

function findDuplicate(index: IndexEntry[], source: string, it: SourceItem): IndexEntry | null {
  const apply = it.apply_url && it.apply_url !== it.source_url ? normalUrl(it.apply_url) : null
  const ownPage = pageKey(it.source_url)
  for (const e of index) {
    if (e.source === source && e.sourceId === it.source_id) continue // itself
    if (ownPage && e.sourceUrl && pageKey(e.sourceUrl) === ownPage) return e // curated from this very page
    if (apply && e.apply && apply === e.apply) return e
    if (sameOpportunity({ title: it.title, deadline: it.deadline }, e)) return e
  }
  return null
}

/** `refresh` re-reads every listing even if the source says it didn't change (after importer fixes). */
export async function syncSource(src: Source, trigger: 'cron' | 'manual', until: number, refresh = false): Promise<SyncResult> {
  const db = adminClient()
  const { data: run } = await db.from('import_runs').insert({ source: src.key, trigger }).select('id').single()
  const result: SyncResult = { source: src.key, fetched: 0, relevant: 0, inserted: 0, updated: 0, skipped: 0, duplicates: 0 }
  try {
    const { data: existingRows } = await db.from('event_imports').select('id, source_id, status, reviewed_at, version:raw->>version, ai:mapped->ai').eq('source', src.key)
    const known = new Map<string, KnownRow & { id: string; reviewed: boolean; ai: AiFill | null }>(
      (existingRows || []).map((r) => [
        r.source_id,
        { id: r.id, status: r.status, reviewed: Boolean(r.reviewed_at), version: refresh ? null : ((r.version as string | null) ?? null), ai: (r.ai as AiFill | null) ?? null },
      ]),
    )
    let aiCalls = 0
    const { items, seen, scanned } = await src.fetch({ known, until })
    result.fetched = scanned
    const index = await duplicateIndex()
    const today = todayBangkok()
    const now = new Date().toISOString()

    for (const it of items) {
      const { score, matched, levels } = scoreRelevance(it)
      const mapped = mapToEvent(src.key, it, matched, levels)
      const reason = skipReason(it, score, today)
      const closed = reason === 'เลยวันปิดรับแล้ว' || reason === 'ปิดรับสมัครแล้ว'
      const prevRow = known.get(it.source_id)
      // Listings headed for the queue: fill missing fields from their own text (checked, cached).
      if (!reason && (await fillGaps(mapped, prevRow?.ai, aiCalls < MAX_CALLS_PER_RUN && Date.now() < until))) aiCalls++
      const flags = [...(it.flags ?? [])]
      if (!it.deadline) flags.push('no_deadline')
      else if (!mapped.deadline_at) flags.push('date_only')
      if (!it.apply_url || it.apply_url === it.source_url) flags.push('no_official_link')
      if (!mapped.overview) flags.push('no_description')

      const row = {
        source: src.key,
        source_id: it.source_id,
        source_url: it.source_url,
        title: mapped.title,
        organizer: mapped.organizer,
        poster_url: mapped.poster_url,
        source_type: it.source_type,
        category: mapped.category,
        deadline: it.deadline,
        deadline_at: mapped.deadline_at,
        mapped,
        raw: { version: it.version ?? null, data: it.raw },
        relevance: score,
        matched,
        levels,
        flags,
        skip_reason: reason,
        last_seen_at: now,
      }
      const prev = known.get(it.source_id)
      if (!reason) result.relevant++

      // Where a listing that passes the filter goes: the queue, or "duplicate" of something we have.
      const placement = () => {
        const dup = findDuplicate(index, src.key, it)
        if (dup) return { status: 'duplicate', duplicate_of: dup.importId ?? null, duplicate_event_id: dup.eventId ?? null }
        return { status: 'pending', duplicate_of: null, duplicate_event_id: null }
      }
      // A new queue entry becomes something later listings (even from this source) can match.
      const remember = (id: string, status: string) => {
        // Never leave a stale entry: two rows must not end up as duplicates of each other.
        for (let i = index.length - 1; i >= 0; i--) if (index[i].importId === id) index.splice(i, 1)
        if (status === 'pending') index.push({ importId: id, source: src.key, sourceId: it.source_id, title: it.title, deadline: it.deadline, apply: normalUrl(it.apply_url) })
      }

      if (!prev) {
        const place = reason ? { status: 'skipped' } : placement()
        const { data: ins, error } = await db.from('event_imports').insert({ ...row, ...place }).select('id').single()
        if (error) throw new Error(`insert failed: ${error.message}`)
        remember(ins.id, place.status)
        if (place.status === 'skipped') result.skipped++
        else if (place.status === 'duplicate') result.duplicates++
        else result.inserted++
        continue
      }

      let patch: Record<string, unknown>
      if (prev.status === 'approved' || prev.status === 'rejected') {
        patch = { raw: row.raw, mapped: row.mapped, flags, last_seen_at: now } // decision stays
      } else if (prev.status === 'pending' || prev.status === 'duplicate') {
        if (closed) patch = { ...row, status: 'expired' }
        else if (prev.status === 'pending' && prev.reviewed) patch = row // admin said "not a duplicate"
        else {
          // Re-check: the matching listing may have appeared, been fixed or been removed since.
          const place = placement()
          patch = { ...row, ...place }
          remember(prev.id, place.status)
        }
      } else if (!reason) {
        const place = placement() // skipped/expired listing that now qualifies (extended, edited)
        patch = { ...row, ...place }
        remember(prev.id, place.status)
      } else {
        patch = row
      }
      await db.from('event_imports').update(patch).eq('id', prev.id)
      result.updated++
    }

    if (seen.length) {
      for (let i = 0; i < seen.length; i += 200) {
        await db.from('event_imports').update({ last_seen_at: now }).eq('source', src.key).in('source_id', seen.slice(i, i + 200))
      }
    }
    // Queue hygiene: deadlines that passed before anyone reviewed them. Skipped rows are kept while
    // the source still lists them (so unchanged pages aren't fetched again), then forgotten.
    await db.from('event_imports').update({ status: 'expired' }).eq('source', src.key).in('status', ['pending', 'duplicate']).lt('deadline', today)
    await db.from('event_imports').delete().eq('source', src.key).eq('status', 'skipped').lt('last_seen_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
  } catch (err) {
    result.error = (err as Error).message
    console.error(`${src.key} sync failed`, err)
  }
  if (run) {
    const { fetched, relevant, inserted, updated, skipped, duplicates, error } = result
    await db.from('import_runs').update({ fetched, relevant, inserted, updated, skipped, duplicates, error: error ?? null, finished_at: new Date().toISOString() }).eq('id', run.id)
  }
  return result
}

export type LastRun = { source: string; started_at: string; finished_at: string | null; error: string | null; blockedRuns: number }

export async function lastRuns(): Promise<Map<string, LastRun>> {
  const { data } = await adminClient().from('import_runs').select('source, started_at, finished_at, error').order('started_at', { ascending: false }).limit(200)
  const out = new Map<string, LastRun>()
  const streakDone = new Set<string>()
  for (const r of data || []) {
    if (!out.has(r.source)) out.set(r.source, { ...r, blockedRuns: 0 })
    // Consecutive most-recent runs that were refused by the site.
    if (streakDone.has(r.source)) continue
    if (r.error && BLOCKED.test(r.error)) out.get(r.source)!.blockedRuns++
    else streakDone.add(r.source)
  }
  return out
}

/**
 * Sync the sources that are due, one after another, within a time budget (Vercel function
 * limit). `force` (admin button) ignores the 6-hour rhythm but not the 10-minute cooldown.
 */
export async function syncDue(trigger: 'cron' | 'manual', opts: { force?: boolean; refresh?: boolean; budgetMs?: number; only?: string[] } = {}): Promise<{ results: SyncResult[]; waiting: string[] }> {
  resetRobots()
  const started = Date.now()
  const budget = opts.budgetMs ?? 50_000
  const runs = await lastRuns()
  const age = (key: string) => {
    const r = runs.get(key)
    return r ? started - Date.parse(r.started_at) : Infinity
  }
  const due = SOURCES.filter((s) => !opts.only || opts.only.includes(s.key))
    .filter((s) => {
      const r = runs.get(s.key)
      if (age(s.key) < MANUAL_COOLDOWN_MS) return false
      if (opts.force || !r) return true
      if (r.blockedRuns) return age(s.key) > blockedWait(r.blockedRuns)
      return age(s.key) > (r.error || !r.finished_at ? RETRY_AFTER_ERROR : DUE_AFTER)
    })
    .sort((a, b) => age(b.key) - age(a.key))

  const results: SyncResult[] = []
  const waiting: string[] = []
  for (const s of due) {
    // Start another source only while there's clearly time left for it.
    if (Date.now() - started > budget * 0.5) {
      waiting.push(s.key)
      continue
    }
    results.push(await syncSource(s, trigger, started + budget - 8_000, opts.refresh))
  }
  return { results, waiting }
}
