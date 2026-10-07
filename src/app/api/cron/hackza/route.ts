import { NextResponse, type NextRequest } from 'next/server'
import { serverEnv } from '@/lib/env'
import { safeEqual } from '@/lib/crypto'
import { syncHackza } from '@/lib/importers/hackza'

export const maxDuration = 60

// Every 6 hours (vercel.json): pull Hackza listings into event_imports as "pending" for admin review.
export async function GET(request: NextRequest) {
  const secret = serverEnv().cronSecret
  if (!secret || !safeEqual(request.headers.get('authorization') || '', `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const result = await syncHackza('cron')
  return NextResponse.json({ ok: !result.error, ...result }, { status: result.error ? 502 : 200 })
}
