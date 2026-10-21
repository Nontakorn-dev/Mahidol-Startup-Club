import 'server-only'
import { adminClient } from '@/lib/supabase/admin'

/**
 * Shared fixed-window limit (Postgres `hit_rate_limit`, one row per key, every instance sees it).
 * Fails open: if the database can't answer, the action goes ahead (availability over strictness).
 */
export async function withinLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await adminClient().rpc('hit_rate_limit', { p_key: key, p_max: max, p_window_seconds: windowSeconds })
  if (error) {
    console.error('hit_rate_limit', key, error.message)
    return true
  }
  return data !== false
}

/** Throws a user-facing error once any of the windows is used up. */
export async function enforceLimits(key: string, limits: [max: number, windowSeconds: number][], message = 'ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่') {
  for (const [max, windowSeconds] of limits) {
    if (!(await withinLimit(`${key}:${windowSeconds}`, max, windowSeconds))) throw new Error(message)
  }
}

export const MINUTE = 60
export const HOUR = 3600
export const DAY = 86_400
