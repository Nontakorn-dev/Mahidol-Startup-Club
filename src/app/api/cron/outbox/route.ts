import { NextResponse, type NextRequest } from 'next/server'
import { isCronRequest } from '@/lib/cron-auth'
import { processOutbox } from '@/lib/outbox'

export const maxDuration = 60

// Called by Supabase pg_cron every minute, but only while queued emails exist.
export async function GET(request: NextRequest) {
  if (!(await isCronRequest(request.headers.get('authorization')))) return NextResponse.json({ ok: false }, { status: 401 })
  const stats = await processOutbox({ budgetMs: 50_000 })
  return NextResponse.json({ ok: true, ...stats })
}
