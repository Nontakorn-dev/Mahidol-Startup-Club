import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { daysUntil, isClosed } from '@/lib/format'
import { HOME_FEATURED_LIMIT, type Category } from '@/lib/constants'
import type { EventRow } from '@/lib/types'

/** Club events pinned first, then open ones by nearest deadline, closed ones last. */
export function sortEvents(events: EventRow[]): EventRow[] {
  const rank = (e: EventRow) => (isClosed(e.deadline) ? 2 : e.is_club ? 0 : 1)
  return [...events].sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r) return r
    if (rank(a) === 2) return (b.deadline || '').localeCompare(a.deadline || '')
    const da = a.deadline ? daysUntil(a.deadline) : -1
    const db = b.deadline ? daysUntil(b.deadline) : -1
    return da - db
  })
}

export async function listPublishedEvents(opts: { category?: Category; ids?: string[] } = {}): Promise<EventRow[]> {
  let q = adminClient().from('events').select('*').eq('status', 'published').limit(200)
  if (opts.category) q = q.eq('category', opts.category)
  if (opts.ids) q = q.in('id', opts.ids.length ? opts.ids : ['00000000-0000-0000-0000-000000000000'])
  const { data } = await q
  return sortEvents((data || []) as EventRow[])
}

export async function getEventBySlug(slug: string, includeDraft = false): Promise<EventRow | null> {
  let q = adminClient().from('events').select('*').eq('slug', slug)
  if (!includeDraft) q = q.eq('status', 'published')
  const { data } = await q.maybeSingle()
  return (data as EventRow) || null
}

/** Up to two open events for the home page "เปิดรับสมัครอยู่ตอนนี้". */
export async function homeFeaturedEvents(): Promise<EventRow[]> {
  const all = (await listPublishedEvents()).filter((e) => !isClosed(e.deadline))
  const featured = all.filter((e) => e.featured)
  const rest = all.filter((e) => !e.featured)
  return [...featured, ...rest].slice(0, HOME_FEATURED_LIMIT)
}

export async function openEventOptions() {
  const all = await listPublishedEvents()
  return all.filter((e) => !isClosed(e.deadline)).map((e) => ({ id: e.id, title: e.title, slug: e.slug }))
}

export async function isSaved(userId: string | undefined, eventId: string) {
  if (!userId) return false
  const { data } = await adminClient()
    .from('saved_events')
    .select('event_id')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle()
  return Boolean(data)
}
