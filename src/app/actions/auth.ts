'use server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { adminClient } from '@/lib/supabase/admin'

type State = { error?: string; sent?: string } | null

const safeNext = (n: FormDataEntryValue | null) => {
  const s = typeof n === 'string' ? n : ''
  return s.startsWith('/') && !s.startsWith('//') ? s : '/'
}

const email = z.email('อีเมลไม่ถูกต้อง').transform((e) => e.trim().toLowerCase())

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
        ? 'ส่งอีเมลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ หรือเข้าสู่ระบบด้วย LINE'
        : `ส่งลิงก์ไม่สำเร็จ: ${error.message}`,
    }
  }
  return { sent: parsed.data }
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
    if (error || !data.user) return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง (ถ้าเคยสมัครด้วยลิงก์อีเมลหรือ LINE ให้ใช้วิธีเดิม)' }
    userId = data.user.id
  }
  const { data: profile } = await adminClient().from('profiles').select('onboarded').eq('id', userId).maybeSingle()
  redirect(profile?.onboarded ? next : `/onboarding?next=${encodeURIComponent(next)}`)
}
