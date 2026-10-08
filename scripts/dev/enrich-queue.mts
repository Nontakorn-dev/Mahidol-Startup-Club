// One-off: fill missing fields on listings waiting in the review queue (status = pending) with the
// checked AI gap-filler. Published events and decided rows are never touched.
// npx tsx --conditions=react-server --env-file=.env.local scripts/dev/enrich-queue.mts
import { adminClient } from '@/lib/supabase/admin'
import { fillGaps, type AiFill } from '@/lib/importers/enrich'
import type { MappedEvent } from '@/lib/importers/map'

const db = adminClient()
const { data } = await db.from('event_imports').select('id, mapped, flags').eq('status', 'pending')
let calls = 0, changed = 0
for (const r of data || []) {
  const m = { ...(r.mapped as MappedEvent & { ai?: AiFill }) }
  const cached = m.ai
  if (await fillGaps(m, cached, true)) calls++
  if (!m.ai?.f.length || JSON.stringify(m) === JSON.stringify(r.mapped)) continue
  const flags = (r.flags as string[]).filter((f) => !(f === 'date_only' && m.deadline_at))
  await db.from('event_imports').update({ mapped: m, organizer: m.organizer, deadline_at: m.deadline_at, flags }).eq('id', r.id)
  changed++
  console.log(`✓ ${m.title.slice(0, 50)} — ${m.ai.f.join(', ')}`)
}
console.log(`\npending rows: ${data?.length ?? 0} · model calls: ${calls} · rows filled: ${changed}`)
