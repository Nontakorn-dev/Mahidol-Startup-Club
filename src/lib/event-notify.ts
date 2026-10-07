import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { notifyUsers, type DispatchStats } from '@/lib/notify'
import { deadlineLine } from '@/lib/format'
import { CATEGORIES, ROLES, type Role } from '@/lib/constants'
import type { EventRow } from '@/lib/types'

/** "งานแข่งที่ตรงกับคุณ": users whose interests/skills overlap the event tags (everyone if untagged). */
export async function notifyEventMatches(e: EventRow): Promise<DispatchStats & { matched: number }> {
  const db = adminClient()
  let q = db.from('profiles').select('id').eq('notify_matches', true).eq('is_suspended', false).limit(5000)
  if (e.tags.length) q = q.overlaps('interests', e.tags)
  const { data } = await q
  const ids = (data || []).map((p) => p.id)
  const roles = e.tags.map((t) => ROLES[t as Role]).filter(Boolean)
  const stats = await notifyUsers(ids, 'matches', {
    altText: `งานใหม่ที่ตรงกับคุณ: ${e.title}`,
    badge: e.is_club ? 'จากชมรม' : 'ตรงกับสกิลของคุณ',
    title: e.title,
    subtitle: [CATEGORIES[e.category], e.summary || (roles.length ? `มองหา ${roles.join(', ')}` : null), deadlineLine(e.deadline, e.open_note)]
      .filter(Boolean)
      .join(' · '),
    imageUrl: e.poster_url,
    actions: [{ type: 'uri', label: 'ดูรายละเอียด', url: `/opportunities/${e.slug}` }],
  })
  await db.from('events').update({ notified_at: new Date().toISOString() }).eq('id', e.id)
  return { ...stats, matched: ids.length }
}
