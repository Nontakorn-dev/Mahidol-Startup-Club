'use server'
import { redirect } from 'next/navigation'
import { revalidatePath, updateTag } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { actionAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { notifyEventMatches } from '@/lib/event-notify'
import { slugify } from '@/lib/format'
import { BOT_UA } from '@/lib/importers/http'
import type { MappedEvent } from '@/lib/importers/map'
import { SOURCE_BY_KEY, syncDue } from '@/lib/importers/sync'
import type { EventRow } from '@/lib/types'

type Mapped = Partial<MappedEvent> & Pick<MappedEvent, 'title' | 'category' | 'source' | 'source_url'>

const POSTER_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Keep our own copy of the poster so the event doesn't break when the source removes it. */
async function copyPoster(url: string | null | undefined, slug: string): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { headers: { 'User-Agent': BOT_UA }, signal: AbortSignal.timeout(15_000) })
    const type = (res.headers.get('content-type') || '').split(';')[0].trim()
    if (!res.ok || !POSTER_TYPES[type]) return url
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 2 * 1024 * 1024) return url // bucket limit; next.config allows the source hosts
    const db = adminClient()
    const path = `imported/${slug.replace(/[^a-z0-9ก-๙-]/gi, '').slice(0, 60) || 'event'}-${Date.now().toString(36)}.${POSTER_TYPES[type]}`
    const { error } = await db.storage.from('posters').upload(path, buf, { contentType: type, upsert: true })
    if (error) return url
    return db.storage.from('posters').getPublicUrl(path).data.publicUrl
  } catch {
    return url
  }
}

async function uniqueSlug(base: string) {
  const db = adminClient()
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    const { data } = await db.from('events').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
  }
  return `${base}-${Date.now().toString(36)}`
}

/** Approve one pending import: create the event (published, or draft to edit first). */
async function approveOne(importId: string, adminId: string, publish: boolean): Promise<EventRow | null> {
  const db = adminClient()
  const now = new Date().toISOString()
  // Claim the import atomically: a double click / two admins can only create one event.
  const { data: imp } = await db
    .from('event_imports')
    .update({ status: 'approved', reviewed_by: adminId, reviewed_at: now })
    .eq('id', importId)
    .neq('status', 'approved')
    .select('*')
    .maybeSingle()
  if (!imp) return null
  const m = imp.mapped as Mapped
  const slug = await uniqueSlug(slugify(m.title))
  const { data: event, error } = await db
    .from('events')
    .insert({
      slug,
      title: m.title,
      category: m.category,
      organizer: m.organizer ?? null,
      summary: m.summary ?? null,
      benefit: m.benefit ?? null,
      eligibility: m.eligibility ?? null,
      overview: m.overview ?? null,
      apply_url: m.apply_url ?? m.source_url,
      deadline: m.deadline ?? null,
      deadline_at: m.deadline_at ?? null,
      event_start: m.event_start ?? null,
      event_end: m.event_end ?? null,
      location: m.location ?? null,
      format: m.format ?? null,
      poster_url: await copyPoster(m.poster_url, slug),
      tags: m.tags ?? [],
      source: m.source,
      source_url: m.source_url,
      status: publish ? 'published' : 'draft',
      published_at: publish ? now : null,
      allow_teams: true,
      notify_on_publish: true,
      created_by: adminId,
      updated_by: adminId,
    })
    .select('*')
    .single()
  if (error || !event) {
    await db.from('event_imports').update({ status: imp.status === 'approved' ? 'pending' : imp.status }).eq('id', importId)
    throw new Error(`สร้างงานไม่สำเร็จ: ${error?.message}`)
  }
  await db.from('event_imports').update({ event_id: event.id }).eq('id', importId)
  return event as EventRow
}

export async function approveImport(form: FormData) {
  const admin = await actionAdmin()
  const id = z.uuid().parse(form.get('id'))
  const publish = form.get('mode') !== 'edit'
  const event = await approveOne(id, admin.userId, publish)
  revalidatePath('/admin/imports')
  updateTag('events')
  revalidatePath('/', 'layout')
  if (event && publish) after(() => notifyEventMatches(event))
  if (event && !publish) redirect(`/admin/events/${event.id}`)
}

export async function approveSelected(form: FormData) {
  const admin = await actionAdmin()
  const ids = z.array(z.uuid()).max(50).parse(form.getAll('ids'))
  const published: EventRow[] = []
  for (const id of ids) {
    const e = await approveOne(id, admin.userId, true)
    if (e) published.push(e)
  }
  revalidatePath('/admin/imports')
  updateTag('events')
  revalidatePath('/', 'layout')
  after(async () => {
    for (const e of published) await notifyEventMatches(e)
  })
}

export async function setImportStatus(form: FormData) {
  const admin = await actionAdmin()
  const id = z.uuid().parse(form.get('id'))
  const status = z.enum(['rejected', 'pending']).parse(form.get('status'))
  await adminClient()
    .from('event_imports')
    .update({
      status,
      reviewed_by: admin.userId,
      reviewed_at: new Date().toISOString(),
      ...(status === 'pending' ? { duplicate_of: null, duplicate_event_id: null, skip_reason: null } : {}),
    })
    .eq('id', id)
    .neq('status', 'approved')
  revalidatePath('/admin/imports')
}

export async function syncNow(form: FormData): Promise<{ ok?: string; error?: string }> {
  await actionAdmin()
  const only = form.get('source')
  const keys = typeof only === 'string' && SOURCE_BY_KEY[only] ? [only] : undefined
  // Be polite to the sources: each one at most once every 10 minutes, even when forced.
  const { results, waiting } = await syncDue('manual', { force: true, budgetMs: 50_000, only: keys })
  revalidatePath('/admin/imports')
  if (!results.length) return { error: 'เพิ่งซิงก์ไปเมื่อไม่นานนี้ — รอ 10 นาทีแล้วลองใหม่ (เพื่อไม่ให้รบกวนเว็บต้นทาง)' }
  const lines = results.map((r) =>
    r.error
      ? `${SOURCE_BY_KEY[r.source].name}: ไม่สำเร็จ (${r.error})`
      : `${SOURCE_BY_KEY[r.source].name}: ใหม่ ${r.inserted} · ซ้ำ ${r.duplicates} · อัปเดต ${r.updated} · ข้าม ${r.skipped}`,
  )
  if (waiting.length) lines.push(`ยังไม่ถึงคิว: ${waiting.map((k) => SOURCE_BY_KEY[k].name).join(', ')} (กดอีกครั้งหลังจากนี้)`)
  return results.every((r) => r.error) ? { error: lines.join('\n') } : { ok: lines.join('\n') }
}
