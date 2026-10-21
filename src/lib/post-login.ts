import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { safeNext } from '@/lib/safe-next'

/**
 * Where to send someone right after they sign in / sign up with email:
 *   1. came from a LINE OA link → its confirmation page (the linkToken expires in 10 min, so first)
 *   2. new account → onboarding
 *   3. otherwise → `next`
 */
export async function resolvePostLogin(userId: string, rawNext: unknown): Promise<string> {
  const next = safeNext(rawNext)
  if (next.startsWith('/line/link?')) return next
  const { data } = await adminClient().from('profiles').select('onboarded').eq('id', userId).maybeSingle()
  return data?.onboarded ? next : `/onboarding?next=${encodeURIComponent(next)}`
}
