// Dry run: fetch each source and print what would reach the queue (no database writes).
// npx tsx --conditions=react-server --env-file=.env.local scripts/dev/try-sources.ts [source…]
import { SOURCES } from '@/lib/importers/sync'
import { scoreRelevance, skipReason } from '@/lib/importers/relevance'
import { todayBangkok } from '@/lib/format'
import { mapToEvent } from '@/lib/importers/map'

const only = process.argv.slice(2)
for (const s of SOURCES.filter((x) => !only.length || only.includes(x.key))) {
  const t = Date.now()
  try {
    const { items, scanned } = await s.fetch({ known: new Map(), until: Date.now() + 45_000 })
    console.log(`\n=== ${s.name}: scanned ${scanned}, items ${items.length} (${((Date.now() - t) / 1000).toFixed(1)}s)`)
    for (const it of items) {
      const { score, matched, levels } = scoreRelevance(it)
      const ok = !skipReason(it, score, todayBangkok())
      if (!ok) continue
      const m = mapToEvent(s.key, it, matched, levels)
      const bad = Object.entries(m).filter(([, v]) => typeof v === 'string' && /^\$[0-9a-f]{1,4}$/.test(v)).map(([k]) => k)
      console.log(`✓ [${score}] ${m.title.slice(0, 70)}\n    ปิด ${m.deadline_at ?? m.deadline ?? '—'} · ${m.organizer ?? '—'} · ${levels.join('/') || '?'} · apply ${m.apply_url?.slice(0, 60)}\n    desc ${m.overview ? m.overview.length + ' chars: ' + m.overview.slice(0, 80).replace(/\n/g, ' ') : 'NONE'}${bad.length ? '  !!! RSC REF in ' + bad : ''}${it.flags?.length ? '\n    flags ' + it.flags.join(',') : ''}`)
    }
    const skipped = items.filter((it) => skipReason(it, scoreRelevance(it).score, todayBangkok()))
    console.log(`  skipped ${skipped.length}: ${skipped.slice(0, 8).map((i) => i.title.slice(0, 30) + ` (${skipReason(i, scoreRelevance(i).score, todayBangkok())})`).join(' | ')}`)
  } catch (e) {
    console.log(`\n=== ${s.name}: ERROR ${(e as Error).message}`)
  }
}
