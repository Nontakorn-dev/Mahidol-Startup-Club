'use server'
import { redirect } from 'next/navigation'
import { revalidatePath, updateTag } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { actionAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { notifyEventMatches } from '@/lib/event-notify'
import { env } from '@/lib/env'
import { slugify } from '@/lib/format'
import type { MappedEvent } from '@/lib/importers/map'
import type { EventRow } from '@/lib/types'

type Mapped = Partial<MappedEvent> & Pick<MappedEvent, 'title' | 'category' | 'source' | 'source_url'>

const POSTER_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const POSTER_UA = `Mozilla/5.0 (compatible; MahidolStartupClubBot/1.0; +${env.siteUrl})`
/** Poster hosts next.config lets next/image load directly (used when a copy isn't possible). */
const RENDERABLE = /(^|\.)supabase\.co$|^s3\.siwatsystem\.com$|^www\.camphub\.in\.th$|^api\.dekport\.com$|^d112y698adiu2z\.cloudfront\.net$/

/** Public web hosts only: the URL came from outside, so never fetch our own network or an IP. */
function publicHttpUrl(raw: string): URL | null {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    const h = u.hostname.toLowerCase()
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':')) return null
    return u
  } catch {
    return null
  }
}

/**
 * Keep our own copy of the poster so the event doesn't break when the source removes it.
 * If it can't be copied, keep the original only when next/image may load it; otherwise none
 * (the admin can upload one on the event page).
 */
async function copyPoster(url: string | null | undefined, slug: string): Promise<string | null> {
  const u = url ? publicHttpUrl(url) : null
  if (!u) return null
  const fallback = RENDERABLE.test(u.hostname) ? u.href : null
  try {
    // Follow redirects by hand so every hop is checked too.
    let target = u
    let res = await fetch(target, { headers: { 'User-Agent': POSTER_UA }, redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    for (let hop = 0; hop < 3 && res.status >= 300 && res.status < 400; hop++) {
      const next = publicHttpUrl(new URL(res.headers.get('location') || '', target).href)
      if (!next) return fallback
      target = next
      res = await fetch(target, { headers: { 'User-Agent': POSTER_UA }, redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    }
    const type = (res.headers.get('content-type') || '').split(';')[0].trim()
    if (!res.ok || !POSTER_TYPES[type]) return fallback
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 2 * 1024 * 1024) return fallback // bucket limit
    const db = adminClient()
    const path = `imported/${slug.replace(/[^a-z0-9ก-๙-]/gi, '').slice(0, 60) || 'event'}-${Date.now().toString(36)}.${POSTER_TYPES[type]}`
    const { error } = await db.storage.from('posters').upload(path, buf, { contentType: type, upsert: true })
    if (error) return fallback
    return db.storage.from('posters').getPublicUrl(path).data.publicUrl
  } catch {
    return fallback
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

/** "รับทราบ" on an approved listing whose closing date changed after it was published. */
export async function dismissDeadlineChange(form: FormData) {
  await actionAdmin()
  const id = z.uuid().parse(form.get('id'))
  const db = adminClient()
  const { data } = await db.from('event_imports').select('flags').eq('id', id).maybeSingle()
  if (data) await db.from('event_imports').update({ flags: (data.flags as string[]).filter((f) => !f.startsWith('deadline_changed:')) }).eq('id', id)
  revalidatePath('/admin/imports')
}
