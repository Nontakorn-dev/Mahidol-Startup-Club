import 'server-only'
import { createHash } from 'node:crypto'
import { adminClient } from '@/lib/supabase/admin'
import { oneClickUnsubscribeUrl, renderNoticeEmail, sendBatch, unsubscribeUrl, type Mail } from '@/lib/email'
import type { NoticeContent } from '@/lib/line/messaging'

// Email outbox: notifications rows with channel='email', status='queued' and the message in
// `payload`. Workers claim up to 100 rows atomically (skip locked), send them as ONE Resend batch
// call, then mark them sent. Run inline right after enqueueing (low latency for single messages)
// and every minute by pg_cron while anything is waiting (large broadcasts, retries, quota pauses).

const BATCH = 100
const MAX_ATTEMPTS = 6

type Row = { id: string; user_id: string; payload: NoticeContent | null; attempts: number }
export type OutboxStats = { sent: number; skipped: number; failed: number; retried: number; paused?: string; remaining: boolean }

function nextUtcMidnight() {
  const d = new Date()
  d.setUTCHours(24, 5, 0, 0)
  return d.toISOString()
}

export async function processOutbox({ budgetMs = 50_000 }: { budgetMs?: number } = {}): Promise<OutboxStats> {
  const db = adminClient()
  const stats: OutboxStats = { sent: 0, skipped: 0, failed: 0, retried: 0, remaining: false }
  const deadline = Date.now() + budgetMs

  while (Date.now() < deadline) {
    const { data: rows, error } = await db.rpc('claim_email_outbox', { batch: BATCH })
    if (error) throw new Error(`claim_email_outbox: ${error.message}`)
    const claimed = (rows || []) as Row[]
    if (!claimed.length) return stats

    // Read addresses/preferences at send time so late unsubscribes are honoured.
    const { data: profiles } = await db
      .from('profiles')
      .select('id, email, email_is_placeholder, email_notifications, is_suspended')
      .in('id', [...new Set(claimed.map((r) => r.user_id))])
    const byId = new Map((profiles || []).map((p) => [p.id, p]))

    const sendable: { row: Row; mail: Mail }[] = []
    const skip: string[] = []
    for (const row of claimed) {
      const p = byId.get(row.user_id)
      if (!row.payload || !p?.email || p.email_is_placeholder || !p.email_notifications || p.is_suspended) {
        skip.push(row.id)
        continue
      }
      const { html, text } = renderNoticeEmail(row.payload, { unsubscribeUrl: unsubscribeUrl(row.user_id) })
      sendable.push({
        row,
        mail: {
          to: p.email,
          subject: row.payload.altText,
          html,
          text,
          // Gmail/Yahoo bulk-sender rules: one-click unsubscribe (RFC 8058).
          headers: {
            'List-Unsubscribe': `<${oneClickUnsubscribeUrl(row.user_id)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        },
      })
    }
    if (skip.length) {
      await db.from('notifications').update({ status: 'skipped', error: 'unsubscribed or no email' }).in('id', skip)
      stats.skipped += skip.length
    }
    if (!sendable.length) continue

    const ids = sendable.map((s) => s.row.id)
    const key = createHash('sha256').update(ids.sort().join(',')).digest('hex').slice(0, 64)
    const res = await sendBatch(sendable.map((s) => s.mail), key)

    if (res.sent) {
      await db.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).in('id', ids)
      stats.sent += res.sent
      continue
    }
    if (res.quotaExceeded) {
      // Plan quota reached: pause everything until it resets instead of hammering the API.
      const until = res.quotaExceeded === 'daily' ? nextUtcMidnight() : new Date(Date.now() + 6 * 3_600_000).toISOString()
      await db.from('notifications').update({ status: 'queued', next_attempt_at: until, error: `quota: ${res.quotaExceeded}` }).in('id', ids)
      stats.retried += ids.length
      stats.paused = `Resend ${res.quotaExceeded} quota reached — resumes ${until}`
      stats.remaining = true
      return stats
    }
    const attempts = sendable[0].row.attempts
    if (res.retryable && attempts < MAX_ATTEMPTS) {
      const backoffMin = Math.min(60, 2 ** attempts)
      await db
        .from('notifications')
        .update({ status: 'queued', next_attempt_at: new Date(Date.now() + backoffMin * 60_000).toISOString(), error: res.error?.slice(0, 300) })
        .in('id', ids)
      stats.retried += ids.length
    } else {
      await db.from('notifications').update({ status: 'failed', error: res.error?.slice(0, 300) }).in('id', ids)
      stats.failed += ids.length
    }
  }
  stats.remaining = true
  return stats
}
