// Run the importer locally (writes to event_imports; never publishes).
// npx tsx --conditions=react-server --env-file=.env.local scripts/dev/sync.mts [--refresh] [source…]
import { syncDue } from '@/lib/importers/sync'

const refresh = process.argv.includes('--refresh')
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const { results, waiting } = await syncDue('manual', { force: true, refresh, budgetMs: 600_000, only: only.length ? only : undefined })
console.table(results)
if (waiting.length) console.log('waiting:', waiting)
