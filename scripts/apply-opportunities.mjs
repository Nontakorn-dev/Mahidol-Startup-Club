// Publishes the hand-curated opportunities in scripts/data/*.json and applies the listed fixes.
// Posters are copied into our own `posters` bucket so they keep working if the source removes them.
// Safe to re-run: events upsert by slug.
//
// Usage: node --env-file=.env.local scripts/apply-opportunities.mjs scripts/data/opportunities-2026-10.json
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const file = process.argv[2]
if (!file) throw new Error('Pass the data file, e.g. scripts/data/opportunities-2026-10.json')
const { events, fixes } = JSON.parse(readFileSync(file, 'utf8'))
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

// Fail early (with a clear message) if migration 0009 hasn't been applied.
const probe = await db.from('events').select('deadline_at, event_start, event_end, location, format').limit(1)
if (probe.error) {
  console.error('✗ events table is missing the new date columns — run supabase/migrations/0009_event_dates_and_location.sql first.')
  console.error('  ', probe.error.message)
  process.exit(1)
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
async function copyPoster(url, slug) {
  if (!url) return null
  const res = await fetch(url, { headers: { 'User-Agent': 'MahidolStartupClub/1.0 (+https://mahidol-startup-club.vercel.app)' } })
  const type = (res.headers.get('content-type') || '').split(';')[0]
  if (!res.ok || !EXT[type]) {
    console.warn(`  ! poster skipped for ${slug} (${res.status} ${type})`)
    return null
  }
  let buf = Buffer.from(await res.arrayBuffer())
  let ext = EXT[type]
  let contentType = type
  // Bucket limit is 2 MB: shrink big images to a 1200 px wide JPEG.
  if (buf.length > 1.8 * 1024 * 1024) {
    buf = await sharp(buf).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    ext = 'jpg'
    contentType = 'image/jpeg'
  }
  const path = `curated/${slug.replace(/[^a-z0-9-]/gi, '').slice(0, 60)}.${ext}`
  const { error } = await db.storage.from('posters').upload(path, buf, { contentType, upsert: true })
  if (error) {
    console.warn(`  ! upload failed for ${slug}: ${error.message}`)
    return null
  }
  return db.storage.from('posters').getPublicUrl(path).data.publicUrl
}

const now = new Date().toISOString()
let ok = 0
for (const e of events) {
  const { poster, ...fields } = e
  const poster_url = await copyPoster(poster, e.slug)
  const row = {
    ...fields,
    poster_url,
    status: 'published',
    published_at: now,
    allow_teams: true,
    featured: false,
    is_club: false,
    // Curated in bulk: don't trigger "new event" notifications for each one.
    notify_on_publish: false,
    notified_at: now,
  }
  const { error } = await db.from('events').upsert(row, { onConflict: 'slug' })
  if (error) console.error(`✗ ${e.slug}: ${error.message}`)
  else {
    ok++
    console.log(`✓ ${e.title.slice(0, 70)}${poster_url ? '' : '  (no poster)'}`)
  }
}

let fixed = 0
for (const { id, ...patch } of fixes || []) {
  const { error } = await db.from('events').update(patch).eq('id', id)
  if (error) console.error(`✗ fix ${id}: ${error.message}`)
  else fixed++
}
console.log(`\n${ok}/${events.length} events published · ${fixed}/${(fixes || []).length} existing events fixed`)
