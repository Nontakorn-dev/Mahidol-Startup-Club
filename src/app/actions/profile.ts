'use server'
import { setLineMenu } from '@/lib/line/richmenu'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { actionViewer } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { ROLE_KEYS } from '@/lib/constants'

type State = { error?: string; ok?: string } | null
const errMsg = (err: unknown) => (err instanceof z.ZodError ? err.issues[0].message : (err as Error).message)
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)
const splitList = (v: FormDataEntryValue | null, max = 12) =>
  String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)

const BasicsSchema = z.object({
  first_name: z.string().trim().min(1, 'กรุณาใส่ชื่อ').max(40),
  last_name: z.string().trim().max(40),
  faculty: optText(60),
  year: optText(30),
  campus: optText(40),
  headline: optText(100),
})

async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error('รูปต้องไม่เกิน 2 MB')
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('รองรับเฉพาะ JPG, PNG หรือ WebP')
  const path = `${userId}/${randomUUID()}.${file.type.split('/')[1]}`
  const db = adminClient()
  const { error } = await db.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: true })
  if (error) throw new Error('อัปโหลดรูปไม่สำเร็จ')
  return db.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

/** Onboarding step 1 of 2. */
export async function saveOnboarding(_prev: State, form: FormData): Promise<State> {
  let next = '/'
  try {
    const viewer = await actionViewer()
    const v = BasicsSchema.parse(Object.fromEntries(['first_name', 'last_name', 'faculty', 'year', 'campus', 'headline'].map((k) => [k, form.get(k) ?? ''])))
    const skills = splitList(form.get('skills'))
    await adminClient().from('profiles').update({ ...v, skills, interests: form.getAll('interests').map(String).slice(0, 7), onboarded: true }).eq('id', viewer.userId)
    const raw = String(form.get('next') || '/')
    next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  } catch (err) {
    return { error: errMsg(err) }
  }
  // One step: straight to where they were going (new members land on /me to link LINE).
  redirect(next === '/' ? '/me#line' : next)
}

const LinkSchema = z.object({ label: z.string().trim().max(30), url: z.url() })

export async function saveProfile(_prev: State, form: FormData): Promise<State> {
  try {
    const viewer = await actionViewer()
    const v = BasicsSchema.parse(Object.fromEntries(['first_name', 'last_name', 'faculty', 'year', 'campus', 'headline'].map((k) => [k, form.get(k) ?? ''])))
    const links = form
      .getAll('link_url')
      .map((url, i) => ({ label: String(form.getAll('link_label')[i] || '').trim() || 'ลิงก์', url: String(url).trim() }))
      .filter((l) => l.url)
      .slice(0, 5)
      .map((l) => {
        const withProto = /^https?:\/\//.test(l.url) ? l.url : `https://${l.url}`
        return LinkSchema.parse({ ...l, url: withProto })
      })
    const experiences = form
      .getAll('exp_title')
      .map((t, i) => ({
        title: String(t).trim().slice(0, 100),
        subtitle: String(form.getAll('exp_subtitle')[i] || '').trim().slice(0, 100),
        description: String(form.getAll('exp_description')[i] || '').trim().slice(0, 300),
      }))
      .filter((e) => e.title)
      .slice(0, 8)
    const update: Record<string, unknown> = {
      ...v,
      bio: optText(1200).parse(form.get('bio') ?? ''),
      skills: splitList(form.get('skills')),
      interests: form.getAll('interests').map(String).slice(0, 7),
      links,
      experiences,
      availability: optText(60).parse(form.get('availability') ?? ''),
      work_mode: optText(60).parse(form.get('work_mode') ?? ''),
      start_when: optText(60).parse(form.get('start_when') ?? ''),
      profile_public: form.get('profile_public') === 'on',
      onboarded: true,
    }
    const avatar = form.get('avatar')
    if (avatar instanceof File && avatar.size > 0) update.avatar_url = await uploadAvatar(viewer.userId, avatar)
    if (form.get('remove_avatar') === '1') update.avatar_url = null
    await adminClient().from('profiles').update(update).eq('id', viewer.userId)
    revalidatePath('/', 'layout')
    return { ok: 'บันทึกโปรไฟล์แล้ว' }
  } catch (err) {
    return { error: errMsg(err) }
  }
}

const PREF_KEYS = ['notify_invites', 'notify_matches', 'notify_reminders', 'notify_announcements', 'email_notifications'] as const

export async function setNotificationPref(key: string, value: boolean | string): Promise<{ error?: string }> {
  try {
    const viewer = await actionViewer()
    if (key === 'notify_frequency') {
      const v = z.enum(['instant', 'daily']).parse(value)
      await adminClient().from('profiles').update({ notify_frequency: v }).eq('id', viewer.userId)
    } else {
      const k = z.enum(PREF_KEYS).parse(key)
      await adminClient().from('profiles').update({ [k]: Boolean(value) }).eq('id', viewer.userId)
    }
    return {}
  } catch (err) {
    return { error: errMsg(err) }
  }
}

export async function unlinkLine(): Promise<{ error?: string }> {
  try {
    const viewer = await actionViewer()
    const lineUserId = viewer.profile.line_user_id
    await adminClient()
      .from('profiles')
      .update({ line_user_id: null, line_display_name: null, line_picture_url: null, line_is_friend: false, line_linked_at: null })
      .eq('id', viewer.userId)
    if (lineUserId) await setLineMenu(lineUserId, false)
    revalidatePath('/me')
    return {}
  } catch (err) {
    return { error: errMsg(err) }
  }
}

/** "เลือกเรื่องที่สนใจ" page (shown right after linking LINE): interests + match notifications. */
export async function saveInterests(form: FormData) {
  const viewer = await actionViewer()
  const interests = form.getAll('interests').map(String).filter((v) => (ROLE_KEYS as string[]).includes(v)).slice(0, 7)
  await adminClient()
    .from('profiles')
    .update({ interests, notify_matches: form.get('notify_matches') === 'on' })
    .eq('id', viewer.userId)
  revalidatePath('/me')
  revalidatePath('/me')
  const raw = String(form.get('next') || '/opportunities')
  redirect(`${raw.startsWith('/') && !raw.startsWith('//') ? raw : '/opportunities'}${raw.includes('?') ? '&' : '?'}saved=interests`)
}
