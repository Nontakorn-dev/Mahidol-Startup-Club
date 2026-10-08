import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { emailEnabled, lineMessagingEnabled } from '@/lib/env'
import { eventsCarousel, lineQuotaRemaining, multicast, noticeFlex, pushMessage, textMessage, type NoticeContent } from '@/lib/line/messaging'
import { processOutbox } from '@/lib/outbox'

export type Topic = 'invites' | 'matches' | 'reminders' | 'announcements' | 'system'

type Recipient = {
  id: string
  email: string | null
  email_is_placeholder: boolean
  email_notifications: boolean
  line_user_id: string | null
  line_is_friend: boolean
  notify_invites: boolean
  notify_matches: boolean
  notify_reminders: boolean
  notify_announcements: boolean
  notify_frequency: 'instant' | 'daily'
  is_suspended: boolean
}

const RECIPIENT_COLS =
  'id, email, email_is_placeholder, email_notifications, line_user_id, line_is_friend, notify_invites, notify_matches, notify_reminders, notify_announcements, notify_frequency, is_suspended'

export type DispatchStats = { line: number; email: number; digest: number; skipped: number; failed: number }

/**
 * Pushes kept back each month for what people must not miss (team invites, deadline reminders).
 * Announcements / digests stop using LINE (→ email) once the remaining quota reaches this.
 */
export const LINE_RESERVE = 30
const URGENT: Topic[] = ['invites', 'reminders']

function wantsTopic(r: Recipient, topic: Topic) {
  if (topic === 'system') return true
  return Boolean(r[`notify_${topic}` as const])
}

/** LINE when linked and the OA is a friend; otherwise email; otherwise skipped. */
function channelFor(r: Recipient, allow: { line: boolean; email: boolean }): 'line' | 'email' | null {
  if (allow.line && lineMessagingEnabled() && r.line_user_id && r.line_is_friend) return 'line'
  if (allow.email && emailEnabled() && r.email && !r.email_is_placeholder && r.email_notifications) return 'email'
  return null
}

/**
 * Send the same notice to many users, honouring each user's topic switches,
 * channel (LINE → email fallback) and frequency (instant vs daily digest).
 */
export async function notifyUsers(
  userIds: string[],
  topic: Topic,
  content: NoticeContent,
  opts: { ignorePrefs?: boolean; broadcastId?: string; allowLine?: boolean; allowEmail?: boolean; url?: string } = {},
): Promise<DispatchStats> {
  const stats: DispatchStats = { line: 0, email: 0, digest: 0, skipped: 0, failed: 0 }
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return stats
  const db = adminClient()
  const allow = { line: opts.allowLine !== false, email: opts.allowEmail !== false }
  const primaryUrl = opts.url ?? (content.actions.find((a) => a.type === 'uri') as { url: string } | undefined)?.url

  const recipients: Recipient[] = []
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await db.from('profiles').select(RECIPIENT_COLS).in('id', ids.slice(i, i + 500))
    recipients.push(...((data || []) as Recipient[]))
  }

  const lineTargets: Recipient[] = []
  const emailTargets: Recipient[] = []
  const rows: Record<string, unknown>[] = []

  for (const r of recipients) {
    const base = {
      user_id: r.id,
      topic,
      title: content.title,
      body: content.subtitle ?? null,
      url: primaryUrl ?? null,
      image_url: content.imageUrl ?? null,
      broadcast_id: opts.broadcastId ?? null,
    }
    if (r.is_suspended || (!opts.ignorePrefs && !wantsTopic(r, topic))) {
      stats.skipped++
      rows.push({ ...base, status: 'skipped' })
      continue
    }
    const channel = channelFor(r, allow)
    if (!channel) {
      stats.skipped++
      rows.push({ ...base, status: 'skipped' })
      continue
    }
    // "งานที่ตรงกับคุณ" on LINE → one weekly digest instead of a push per event (quota).
    if (channel === 'line' && topic === 'matches' && !opts.ignorePrefs) {
      stats.digest++
      rows.push({ ...base, status: 'weekly', channel })
      continue
    }
    if (r.notify_frequency === 'daily' && topic !== 'system' && !opts.ignorePrefs) {
      stats.digest++
      rows.push({ ...base, status: 'digest', channel })
      continue
    }
    if (channel === 'line') {
      rows.push({ ...base, status: 'sent', channel, sent_at: new Date().toISOString() })
      lineTargets.push(r)
    } else {
      rows.push({ ...base, status: 'queued', channel, payload: content })
      emailTargets.push(r)
    }
  }

  if (lineTargets.length) {
    // Fall back to email for those who have one.
    const toEmail = (reason: string) => {
      const rowByUser = new Map(rows.map((x) => [x.user_id as string, x]))
      for (const r of lineTargets) {
        const row = rowByUser.get(r.id)!
        if (allow.email && r.email && !r.email_is_placeholder && r.email_notifications && emailEnabled()) {
          Object.assign(row, { channel: 'email', status: 'queued', payload: content, sent_at: null })
          emailTargets.push(r)
        } else {
          row.status = 'failed'
          row.error = reason.slice(0, 300)
          stats.failed++
        }
      }
    }
    const remaining = await lineQuotaRemaining()
    const budget = remaining === null ? Infinity : remaining - (URGENT.includes(topic) ? 0 : LINE_RESERVE)
    if (lineTargets.length > budget) {
      toEmail(`LINE monthly quota: ${remaining} left`)
    } else {
      const message = noticeFlex(content)
      try {
        if (lineTargets.length === 1) await pushMessage(lineTargets[0].line_user_id!, [message])
        else await multicast(lineTargets.map((r) => r.line_user_id!), [message])
        stats.line += lineTargets.length
      } catch (err) {
        console.error('LINE send failed', err)
        toEmail(String(err))
      }
    }
  }

  stats.email = emailTargets.length // queued; delivered by the outbox worker
  for (let i = 0; i < rows.length; i += 500) {
    await db.from('notifications').insert(rows.slice(i, i + 500))
  }
  // Deliver right away when small; anything left is drained by pg_cron every minute.
  if (emailTargets.length) await processOutbox({ budgetMs: 8_000 }).catch((err) => console.error('outbox', err))
  return stats
}

/** Daily digest for users who chose "สรุปวันละครั้ง". */
export async function sendDigests(): Promise<number> {
  const db = adminClient()
  const { data: pending } = await db
    .from('notifications')
    .select('id, user_id, title, url, channel')
    .eq('status', 'digest')
    .order('created_at')
    .limit(5000)
  if (!pending?.length) return 0
  const byUser = new Map<string, typeof pending>()
  for (const n of pending) byUser.set(n.user_id, [...(byUser.get(n.user_id) || []), n])

  const { data: profiles } = await db
    .from('profiles')
    .select('id, email, email_is_placeholder, line_user_id, line_is_friend')
    .in('id', [...byUser.keys()])
  const queued: Record<string, unknown>[] = []
  let count = 0
  for (const p of profiles || []) {
    const items = byUser.get(p.id) || []
    const lines = items.slice(0, 8).map((n) => `• ${n.title}`)
    const more = items.length > 8 ? `\nและอีก ${items.length - 8} รายการ` : ''
    const content: NoticeContent = {
      altText: `สรุปวันนี้จาก Mahidol Startup Club (${items.length} เรื่อง)`,
      headerBar: 'สรุปประจำวัน',
      title: `มี ${items.length} เรื่องที่คุณอาจสนใจ`,
      subtitle: lines.join('\n') + more,
      actions: [{ type: 'uri', label: 'ดูบนเว็บ', url: '/inbox' }],
    }
    try {
      const lineOk = p.line_user_id && p.line_is_friend && lineMessagingEnabled() && ((await lineQuotaRemaining()) ?? Infinity) > LINE_RESERVE
      if (lineOk) {
        await pushMessage(p.line_user_id!, [noticeFlex(content)])
      } else if (p.email && !p.email_is_placeholder) {
        queued.push({ user_id: p.id, topic: 'system', title: content.title, url: '/inbox', status: 'queued', channel: 'email', payload: content })
      }
      count++
    } catch (err) {
      console.error('digest failed', p.id, err)
    }
  }
  if (queued.length) {
    for (let i = 0; i < queued.length; i += 500) await db.from('notifications').insert(queued.slice(i, i + 500))
  }
  await db
    .from('notifications')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .in('id', pending.map((n) => n.id))
  return count
}

/**
 * Monday 08:00: one LINE message per person with the week's "งานที่ตรงกับคุณ" (carousel of
 * events still open). One push per person per week keeps a free OA (300/month) workable for
 * ~60 active members. People without LINE (or when the quota is low) get it by email.
 */
export async function sendWeeklyLineDigest(): Promise<{ line: number; email: number; rows: number }> {
  const db = adminClient()
  const { data: pending } = await db.from('notifications').select('id, user_id, title, url, image_url').eq('status', 'weekly').order('created_at').limit(10000)
  if (!pending?.length) return { line: 0, email: 0, rows: 0 }
  const byUser = new Map<string, typeof pending>()
  for (const n of pending) byUser.set(n.user_id, [...(byUser.get(n.user_id) || []), n])

  const { listPublishedEvents } = await import('@/lib/data/events')
  const { isClosed, thaiDeadline, msLeft, timeLeftLabel } = await import('@/lib/format')
  const events = new Map((await listPublishedEvents()).map((e) => [`/opportunities/${e.slug}`, e]))
  const { data: profiles } = await db.from('profiles').select('id, first_name, email, email_is_placeholder, email_notifications, line_user_id, line_is_friend').in('id', [...byUser.keys()])

  let line = 0
  let email = 0
  const emails: Record<string, unknown>[] = []
  for (const p of profiles || []) {
    const items = (byUser.get(p.id) || [])
      .map((n) => ({ n, e: events.get((n.url || '').split('?')[0]) }))
      .filter((x) => x.e && !isClosed(x.e))
    if (!items.length) continue
    const title = `งานใหม่ที่ตรงกับคุณสัปดาห์นี้ ${items.length} งาน`
    const lineOk = p.line_user_id && p.line_is_friend && lineMessagingEnabled() && ((await lineQuotaRemaining()) ?? Infinity) > LINE_RESERVE
    if (lineOk) {
      try {
        await pushMessage(p.line_user_id!, [
          eventsCarousel(
            title,
            items.slice(0, 9).map(({ e }) => ({
              title: e!.title,
              subtitle: e!.deadline ? `ปิดรับ ${thaiDeadline(e!)}` : 'เปิดรับสมัครอยู่',
              imageUrl: e!.poster_url,
              url: `/opportunities/${e!.slug}?src=line`,
              badge: msLeft(e!) !== null ? timeLeftLabel(msLeft(e!)) : undefined,
              badgeTone: 'blue' as const,
            })),
            '/opportunities?src=line',
          ),
          textMessage(`⭐ ${title}${p.first_name ? ` คุณ${p.first_name}` : ''} — แก้เรื่องที่สนใจได้ที่เมนู “บัญชี & ความสนใจ”`),
        ])
        line++
        continue
      } catch (err) {
        console.error('weekly LINE digest', p.id, err)
      }
    }
    if (p.email && !p.email_is_placeholder && p.email_notifications) {
      const content: NoticeContent = {
        altText: title,
        headerBar: 'สรุปประจำสัปดาห์',
        title,
        subtitle: items.slice(0, 8).map(({ e }) => `• ${e!.title}`).join('\n'),
        actions: [{ type: 'uri', label: 'ดูทั้งหมดบนเว็บ', url: '/opportunities' }],
      }
      emails.push({ user_id: p.id, topic: 'matches', title, url: '/opportunities', status: 'queued', channel: 'email', payload: content })
      email++
    }
  }
  for (let i = 0; i < emails.length; i += 500) await db.from('notifications').insert(emails.slice(i, i + 500))
  await db.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).in('id', pending.map((n) => n.id))
  if (emails.length) await processOutbox({ budgetMs: 8_000 }).catch((err) => console.error('outbox', err))
  return { line, email, rows: pending.length }
}
