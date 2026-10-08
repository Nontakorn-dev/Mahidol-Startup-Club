import 'server-only'
import { serverEnv } from '@/lib/env'
import { safeEqual } from '@/lib/crypto'
import { adminClient } from '@/lib/supabase/admin'

/** Scheduled callers: Vercel Cron (CRON_SECRET) or Supabase pg_cron (token kept in Supabase Vault). */
export async function isCronRequest(header: string | null): Promise<boolean> {
  const h = header || ''
  const secret = serverEnv().cronSecret
  if (secret && safeEqual(h, `Bearer ${secret}`)) return true
  const token = h.startsWith('Bearer ') ? h.slice(7) : ''
  if (!token) return false
  const { data } = await adminClient().rpc('check_cron_token', { t: token })
  return data === true
}
