// Dry run of the AI gap-filler on rows already in the import queue — prints what would be filled,
// what was rejected as not-in-text, and token usage. Writes nothing.
// AI_DEBUG=1 npx tsx --conditions=react-server --env-file=.env.local scripts/dev/enrich-dryrun.mts [limit]
import { adminClient } from '@/lib/supabase/admin'
import { fillGaps } from '@/lib/importers/enrich'
import type { MappedEvent } from '@/lib/importers/map'

const limit = Number(process.argv[2] || 8)
const { data } = await adminClient().from('event_imports').select('source, mapped').in('status', ['pending', 'approved']).order('first_seen_at', { ascending: false }).limit(60)
let calls = 0
for (const r of data || []) {
  if (calls >= limit) break
  const before = { ...(r.mapped as MappedEvent) }
  const m = { ...(r.mapped as MappedEvent) }
  delete (m as { ai?: unknown }).ai
  if (await fillGaps(m, null, true)) calls++
  else continue
  const ai = (m as { ai?: { f: string[]; n: string[] } }).ai
  console.log(`\n[${r.source}] ${m.title.slice(0, 60)}\n  asked: ${ai?.n.join(',')}  filled: ${ai?.f.join(', ') || '—'}`)
  for (const f of ai?.f ?? []) console.log(`    ${f}: ${JSON.stringify((before as Record<string, unknown>)[f] ?? null)} → ${JSON.stringify((m as Record<string, unknown>)[f])}`)
}
console.log(`\nmodel calls: ${calls}`)
