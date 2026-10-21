import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import type { Profile } from '@/lib/types'

export type Viewer = { userId: string; email: string | null; profile: Profile }

/** The signed-in user and their profile, or null. Memoised per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient()
  // Verified locally against the project's ES256 JWKS — no Auth round-trip per request.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  const user = { id: claims.sub, email: (claims.email as string | undefined) ?? null }

  const db = adminClient()
  let { data: profile } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (!profile) {
    // Trigger missed (e.g. user created before migration) — create it now.
    const { data } = await db
      .from('profiles')
      .upsert({ id: user.id, email: user.email })
      .select('*')
      .single()
    profile = data
  }
  if (!profile) return null

  const email = (user.email || '').toLowerCase()
  if (profile.role !== 'admin' && email && serverEnv().adminEmails.includes(email) && !profile.email_is_placeholder && (await mayAutoPromote(user.id))) {
    await db.from('profiles').update({ role: 'admin' }).eq('id', user.id)
    await db.from('admin_audit_log').insert({ actor_id: user.id, action: 'user.auto_admin', target_type: 'user', target_id: user.id, details: { source: 'ADMIN_EMAILS' } })
    profile.role = 'admin'
  }
  return { userId: user.id, email: user.email, profile: profile as Profile }
})

/**
 * ADMIN_EMAILS grants admin only to a confirmed address (checked against Auth, not just the JWT),
 * and never again to someone another admin removed (the revoke is in the audit log).
 */
async function mayAutoPromote(userId: string): Promise<boolean> {
  const db = adminClient()
  const { data } = await db.auth.admin.getUserById(userId)
  if (!data?.user?.email_confirmed_at) return false
  const { data: revoked } = await db.from('admin_audit_log').select('id').eq('action', 'user.revoke_admin').eq('target_id', userId).limit(1)
  return !revoked?.length
}

export async function requireViewer(next = '/'): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`)
  return viewer
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer('/admin')
  if (viewer.profile.role !== 'admin') redirect('/')
  return viewer
}

/** For server actions: returns the viewer or throws a user-facing error. */
export async function actionViewer(): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) throw new Error('กรุณาเข้าสู่ระบบก่อน')
  if (viewer.profile.is_suspended) throw new Error('บัญชีของคุณถูกระงับการใช้งานชั่วคราว')
  return viewer
}

export async function actionAdmin(): Promise<Viewer> {
  const viewer = await actionViewer()
  if (viewer.profile.role !== 'admin') throw new Error('เฉพาะผู้ดูแลระบบ')
  return viewer
}
