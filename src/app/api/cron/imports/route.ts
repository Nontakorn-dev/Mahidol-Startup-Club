import { NextResponse, type NextRequest } from 'next/server'
import { isCronRequest } from '@/lib/cron-auth'
import { syncDue } from '@/lib/importers/sync'

export const maxDuration = 60

// Pull listings from every source into event_imports for admin review (never auto-published).
// Callers: Supabase pg_cron every hour (token kept in Supabase Vault — Vercel Hobby only allows
// daily crons) and a daily Vercel cron as a safety net (CRON_SECRET). Each source is synced at
// most every ~6 hours; one call handles as many due sources as fit in the time budget.
export async function GET(request: NextRequest) {
  if (!(await isCronRequest(request.headers.get('authorization')))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const { results, waiting } = await syncDue('cron')
  const failed = results.filter((r) => r.error)
  return NextResponse.json({ ok: failed.length === 0, results, waiting }, { status: failed.length && failed.length === results.length ? 502 : 200 })
}
