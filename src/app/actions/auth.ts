'use server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { resolvePostLogin, safeNext } from '@/lib/post-login'

type State = { error?: string; sent?: string } | null

const email = z.email('อีเมลไม่ถูกต้อง').transform((e) => e.trim().toLowerCase())

/** Email link + 6-digit code (same email). Creates the account on first use. */
export async function sendMagicLink(_prev: State, form: FormData): Promise<State> {
  const parsed = email.safeParse(form.get('email'))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const next = safeNext(form.get('next'))
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  })
  if (error) {
    return {
      error: /rate|seconds/i.test(error.message)
        ? 'ส่งอีเมลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ หรือใช้รหัสผ่านแทน'
        : `ส่งอีเมลไม่สำเร็จ: ${error.message}`,
    }
  }
  return { sent: parsed.data }
}

/** Verify the 6-digit code from the email — works inside LINE's in-app browser without switching apps. */
export async function verifyEmailCode(_prev: State, form: FormData): Promise<State> {
  const parsed = z
    .object({ email, token: z.string().trim().regex(/^\d{6,8}$/, 'รหัสต้องเป็นตัวเลข 6 หลัก') })
    .safeParse({ email: form.get('email'), token: form.get('token') })
  if (!parsed.success) return { error: parsed.error.issues[0].message, sent: String(form.get('email') || '') }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.token, type: 'email' })
  if (error || !data.user) return { error: 'รหัสไม่ถูกต้องหรือหมดอายุ', sent: parsed.data.email }
  redirect(await resolvePostLogin(data.user.id, form.get('next')))
}

const PasswordSchema = z.object({ email, password: z.string().min(8, 'รหัสผ่านอย่างน้อย 8 ตัวอักษร').max(72) })

export async function passwordAuth(_prev: State, form: FormData): Promise<State> {
  const parsed = PasswordSchema.safeParse({ email: form.get('email'), password: form.get('password') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const next = safeNext(form.get('next'))
  const supabase = await createClient()
  let userId: string
  if (form.get('mode') === 'signup') {
    const { data, error } = await supabase.auth.signUp({
      ...parsed.data,
      options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (error) return { error: error.message.includes('registered') ? 'อีเมลนี้มีบัญชีแล้ว ลองเข้าสู่ระบบแทน' : error.message }
    if (!data.session || !data.user) return { sent: parsed.data.email }
    userId = data.user.id
  } else {
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
    if (error || !data.user) return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง (ถ้าเคยสมัครด้วยลิงก์/รหัสทางอีเมล ให้ใช้วิธีเดิม)' }
    userId = data.user.id
  }
  redirect(await resolvePostLogin(userId, next))
}
