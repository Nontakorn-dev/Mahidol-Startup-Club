'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { actionViewer } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { emailEnabled, env } from '@/lib/env'
import { signPayload } from '@/lib/crypto'
import { noticeEmailHtml, sendEmails } from '@/lib/email'

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
  redirect(`/settings/notifications?onboarding=1&next=${encodeURIComponent(next)}`)
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
    if (viewer.profile.email_is_placeholder) {
      return { error: 'เพิ่มอีเมลก่อนยกเลิกการเชื่อม LINE ไม่เช่นนั้นจะเข้าสู่ระบบไม่ได้' }
    }
    await adminClient()
      .from('profiles')
      .update({ line_user_id: null, line_display_name: null, line_picture_url: null, line_is_friend: false, line_linked_at: null })
      .eq('id', viewer.userId)
    revalidatePath('/settings/notifications')
    return {}
  } catch (err) {
    return { error: errMsg(err) }
  }
}

/** For LINE-only accounts: verify a real email so announcements can also go by email. */
export async function requestEmailVerification(_prev: State, form: FormData): Promise<State> {
  try {
    const viewer = await actionViewer()
    const email = z.email('อีเมลไม่ถูกต้อง').parse(String(form.get('email') || '').trim().toLowerCase())
    if (!emailEnabled()) throw new Error('ระบบส่งอีเมลยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแล')
    const { data: taken } = await adminClient().from('profiles').select('id').eq('email', email).neq('id', viewer.userId).maybeSingle()
    if (taken) throw new Error('อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว')
    const token = signPayload({ uid: viewer.userId, email, k: 'verify-email' }, 60 * 60 * 24)
    const url = `${env.siteUrl}/api/account/verify-email?t=${encodeURIComponent(token)}`
    const html = noticeEmailHtml(
      {
        altText: 'ยืนยันอีเมลของคุณ',
        title: 'ยืนยันอีเมลสำหรับ Mahidol Startup Club',
        subtitle: 'กดปุ่มด้านล่างภายใน 24 ชั่วโมง เพื่อใช้อีเมลนี้เข้าสู่ระบบและรับข่าวสาร',
        actions: [{ type: 'uri', label: 'ยืนยันอีเมล', url }],
      },
      'ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร',
    )
    const res = await sendEmails([{ to: email, subject: 'ยืนยันอีเมล — Mahidol Startup Club', html, text: url }])
    if (!res.sent) throw new Error('ส่งอีเมลไม่สำเร็จ')
    return { ok: `ส่งลิงก์ยืนยันไปที่ ${email} แล้ว` }
  } catch (err) {
    return { error: errMsg(err) }
  }
}
