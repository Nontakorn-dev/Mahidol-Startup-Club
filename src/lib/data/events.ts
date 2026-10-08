import 'server-only'
import { unstable_cache } from 'next/cache'
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

export const EVENTS_TAG = 'events'

/**
 * All published events, cached across requests for 60 s (tag `events`). Every page that lists
 * events reads this one cached query, so traffic spikes don't turn into database load.
 * Admin mutations call updateTag('events') so changes show up immediately.
 */
const publishedEventRows = unstable_cache(
  async (): Promise<EventRow[]> => {
    const { data } = await adminClient().from('events').select('*').eq('status', 'published').limit(500)
    return (data || []) as EventRow[]
  },
  ['published-events'],
  { revalidate: 60, tags: [EVENTS_TAG] },
)

export async function listPublishedEvents(opts: { category?: Category; ids?: string[] } = {}): Promise<EventRow[]> {
  let rows = await publishedEventRows()
  if (opts.category) rows = rows.filter((e) => e.category === opts.category)
  if (opts.ids) {
    const ids = new Set(opts.ids)
    rows = rows.filter((e) => ids.has(e.id))
  }
  return sortEvents(rows)
}

export async function getEventBySlug(slug: string, includeDraft = false): Promise<EventRow | null> {
  if (!includeDraft) return (await publishedEventRows()).find((e) => e.slug === slug) ?? null
  const { data } = await adminClient().from('events').select('*').eq('slug', slug).maybeSingle()
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
