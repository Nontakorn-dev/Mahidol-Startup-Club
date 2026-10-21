import 'server-only'
import { adminClient } from '@/lib/supabase/admin'

/** Admin audit trail (table admin_audit_log). Never blocks the action itself if logging fails. */
export async function audit(actorId: string, action: string, target?: { type: string; id: string | null } | null, details: Record<string, unknown> = {}) {
  const { error } = await adminClient()
    .from('admin_audit_log')
    .insert({ actor_id: actorId, action, target_type: target?.type ?? null, target_id: target?.id ?? null, details })
  if (error) console.error('audit log', action, error.message)
}
