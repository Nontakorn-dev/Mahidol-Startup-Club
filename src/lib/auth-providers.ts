import 'server-only'
import { env } from '@/lib/env'

/** Which OAuth providers are switched on in Supabase (public settings endpoint, cached 5 min). */
export async function enabledProviders(): Promise<{ google: boolean }> {
  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: env.supabasePublishableKey },
      next: { revalidate: 300 },
    })
    if (!res.ok) return { google: false }
    const body = (await res.json()) as { external?: Record<string, boolean> }
    return { google: Boolean(body.external?.google) }
  } catch {
    return { google: false }
  }
}
