'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { actionAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { notifyEventMatches } from '@/lib/event-notify'
import { slugify } from '@/lib/format'
import { syncHackza } from '@/lib/importers/hackza'
import type { EventRow } from '@/lib/types'

type Mapped = {
  title: string
  category: string
  organizer: string | null
  summary: string | null
  benefit: string | null
  eligibility: string | null
  overview: string | null
  apply_url: string | null
  deadline: string | null
  poster_url: string | null
  tags: string[]
  source: string
  source_url: string
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
  const { data: imp } = await db.from('event_imports').select('*').eq('id', importId).maybeSingle()
  if (!imp || imp.status === 'approved') return null
  const m = imp.mapped as Mapped
  const now = new Date().toISOString()
  const { data: event, error } = await db
    .from('events')
    .insert({
      slug: await uniqueSlug(slugify(m.title)),
      title: m.title,
      category: m.category,
      organizer: m.organizer,
      summary: m.summary,
      benefit: m.benefit,
      eligibility: m.eligibility,
      overview: m.overview,
      apply_url: m.apply_url,
      deadline: m.deadline,
      poster_url: m.poster_url,
      tags: m.tags,
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
  if (error || !event) throw new Error(`สร้างงานไม่สำเร็จ: ${error?.message}`)
  await db.from('event_imports').update({ status: 'approved', event_id: event.id, reviewed_by: adminId, reviewed_at: now }).eq('id', importId)
  return event as EventRow
}

export async function approveImport(form: FormData) {
  const admin = await actionAdmin()
  const id = z.uuid().parse(form.get('id'))
  const publish = form.get('mode') !== 'edit'
  const event = await approveOne(id, admin.userId, publish)
  revalidatePath('/admin/imports')
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
    .update({ status, reviewed_by: admin.userId, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .neq('status', 'approved')
  revalidatePath('/admin/imports')
}

export async function syncNow(): Promise<{ ok?: string; error?: string }> {
  await actionAdmin()
  const db = adminClient()
  // Be polite to Hackza: at most one manual sync every 10 minutes.
  const { data: last } = await db.from('import_runs').select('started_at').eq('source', 'hackza').order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (last && Date.now() - new Date(last.started_at).getTime() < 10 * 60_000) {
    return { error: 'เพิ่งซิงก์ไปเมื่อไม่นานนี้ — รอ 10 นาทีแล้วลองใหม่ (เพื่อไม่ให้รบกวนเว็บต้นทาง)' }
  }
  const r = await syncHackza('manual')
  revalidatePath('/admin/imports')
  if (r.error) return { error: `ซิงก์ไม่สำเร็จ: ${r.error}` }
  return { ok: `ดึงมา ${r.fetched} รายการ · เกี่ยวข้อง ${r.relevant} · ใหม่ ${r.inserted} · อัปเดต ${r.updated} · ข้าม ${r.skipped}` }
}
