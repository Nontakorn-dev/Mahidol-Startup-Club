import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { accountLinkUrl, isLinkToken, pendingLinkRedirect } from '@/lib/line/link'

export const safeNext = (n: unknown) => {
  const s = typeof n === 'string' ? n : ''
  return s.startsWith('/') && !s.startsWith('//') ? s : '/'
}

/**
 * Where to send someone right after they sign in / sign up with email:
 *   1. came from a LINE OA link → LINE account-link confirmation (linkToken expires in 10 min, so first)
 *   2. new account → onboarding
 *   3. otherwise → `next`
 */
export async function resolvePostLogin(userId: string, rawNext: unknown): Promise<string> {
  const next = safeNext(rawNext)
  const pending = await pendingLinkRedirect(userId)
  if (pending) return pending
  const m = next.match(/^\/line\/link\?linkToken=([^&]+)/)
  if (m && isLinkToken(decodeURIComponent(m[1]))) return accountLinkUrl(userId, decodeURIComponent(m[1]))
  const { data } = await adminClient().from('profiles').select('onboarded').eq('id', userId).maybeSingle()
  return data?.onboarded ? next : `/onboarding?next=${encodeURIComponent(next)}`
}
