import { NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { getViewer } from '@/lib/auth'

// Records "กดสมัคร" clicks (sent with navigator.sendBeacon) for the admin dashboard.
export async function POST(_req: Request, ctx: RouteContext<'/api/events/[id]/track'>) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ ok: false }, { status: 400 })
  const viewer = await getViewer()
  await adminClient().from('event_metrics').insert({ event_id: id, kind: 'apply', user_id: viewer?.userId ?? null })
  return NextResponse.json({ ok: true })
}
