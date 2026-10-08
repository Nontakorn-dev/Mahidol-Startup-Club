import { NextResponse, type NextRequest } from 'next/server'
import { isCronRequest } from '@/lib/cron-auth'
import { adminClient } from '@/lib/supabase/admin'
import { syncHackza } from '@/lib/importers/hackza'

export const maxDuration = 60

// Pull Hackza listings into event_imports as "pending" for admin review.
// Callers: Supabase pg_cron every 6 hours (token kept in Supabase Vault — Vercel Hobby
// only allows daily crons) and a daily Vercel cron as a safety net (CRON_SECRET).
export async function GET(request: NextRequest) {
  if (!(await isCronRequest(request.headers.get('authorization')))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  // Be polite to Hackza: skip if a successful sync already ran in the last 5 hours.
  const { data: last } = await adminClient()
    .from('import_runs')
    .select('started_at')
    .eq('source', 'hackza')
    .is('error', null)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (last && Date.now() - new Date(last.started_at).getTime() < 5 * 3_600_000) {
    return NextResponse.json({ ok: true, skipped: 'recent sync' })
  }
  const result = await syncHackza('cron')
  return NextResponse.json({ ok: !result.error, ...result }, { status: result.error ? 502 : 200 })
}
