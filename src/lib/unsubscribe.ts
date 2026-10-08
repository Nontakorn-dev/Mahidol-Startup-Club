import 'server-only'
import { verifyPayload } from '@/lib/crypto'
import { adminClient } from '@/lib/supabase/admin'

export function unsubscribeUserId(token: string | null | undefined): string | null {
  const p = verifyPayload<{ u: string; k: string }>(token)
  return p?.k === 'unsub' && typeof p.u === 'string' ? p.u : null
}

export async function unsubscribeEmail(userId: string) {
  await adminClient().from('profiles').update({ email_notifications: false }).eq('id', userId)
}
