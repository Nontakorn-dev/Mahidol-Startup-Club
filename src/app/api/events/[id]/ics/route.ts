import { NextResponse } from 'next/server'
import { listPublishedEvents } from '@/lib/data/events'
import { eventIcs } from '@/lib/calendar'

export async function GET(_req: Request, ctx: RouteContext<'/api/events/[id]/ics'>) {
  const { id } = await ctx.params
  const e = (await listPublishedEvents({ ids: [id] }))[0]
  if (!e || !e.deadline) return NextResponse.json({ ok: false }, { status: 404 })
  return new NextResponse(eventIcs(e), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="deadline-${e.slug.slice(0, 40).replace(/[^\w-]/g, '') || 'event'}.ics"`,
    },
  })
}
