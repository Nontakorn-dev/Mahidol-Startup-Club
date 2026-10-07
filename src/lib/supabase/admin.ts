import 'server-only'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, serverEnv } from '@/lib/env'

let cached: SupabaseClient | null = null

/**
 * Service-role client. Bypasses RLS — only call it after the caller has been
 * authenticated/authorised in server code, and never return raw rows to the
 * browser without passing them through the sanitizers in lib/data.
 */
export function adminClient(): SupabaseClient {
  if (cached) return cached
  const key = serverEnv().supabaseSecretKey
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set')
  cached = createSupabaseClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
