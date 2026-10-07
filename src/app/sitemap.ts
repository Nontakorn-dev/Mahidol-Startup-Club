import type { MetadataRoute } from 'next'
import { listPublishedEvents } from '@/lib/data/events'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const events = await listPublishedEvents().catch(() => [])
  return [
    { url: site, changeFrequency: 'daily', priority: 1 },
    { url: `${site}/opportunities`, changeFrequency: 'daily' },
    { url: `${site}/teams` },
    { url: `${site}/cofounder` },
    ...events.map((e) => ({ url: `${site}/opportunities/${e.slug}`, lastModified: e.updated_at })),
  ]
}
