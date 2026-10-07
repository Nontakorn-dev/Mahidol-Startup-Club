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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const db = adminClient()
  let { data: profile } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (!profile) {
    // Trigger missed (e.g. user created before migration) — create it now.
    const { data } = await db
      .from('profiles')
      .upsert({ id: user.id, email: user.email ?? null })
      .select('*')
      .single()
    profile = data
  }
  if (!profile) return null

  const email = (user.email || '').toLowerCase()
  if (profile.role !== 'admin' && email && serverEnv().adminEmails.includes(email) && !profile.email_is_placeholder) {
    await db.from('profiles').update({ role: 'admin' }).eq('id', user.id)
    profile.role = 'admin'
  }
  return { userId: user.id, email: user.email ?? null, profile: profile as Profile }
})

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
