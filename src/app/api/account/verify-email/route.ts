import { NextResponse, type NextRequest } from 'next/server'
import { verifyPayload } from '@/lib/crypto'
import { adminClient } from '@/lib/supabase/admin'

// Confirms an email added to a LINE-only account (link sent by requestEmailVerification).
export async function GET(request: NextRequest) {
  const payload = verifyPayload<{ uid: string; email: string; k: string }>(request.nextUrl.searchParams.get('t'))
  const to = (q: string) => NextResponse.redirect(new URL(`/settings/notifications?${q}`, request.url))
  if (!payload || payload.k !== 'verify-email') return to(`email_error=${encodeURIComponent('ลิงก์หมดอายุหรือไม่ถูกต้อง')}`)
  const db = adminClient()
  const { data: taken } = await db.from('profiles').select('id').eq('email', payload.email).neq('id', payload.uid).maybeSingle()
  if (taken) return to(`email_error=${encodeURIComponent('อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว')}`)
  const { error } = await db.auth.admin.updateUserById(payload.uid, { email: payload.email, email_confirm: true })
  if (error) return to(`email_error=${encodeURIComponent('ยืนยันอีเมลไม่สำเร็จ')}`)
  // Trigger on auth.users syncs profiles.email / is_verified; make sure the flag is cleared.
  await db.from('profiles').update({ email: payload.email, email_is_placeholder: false }).eq('id', payload.uid)
  return to('email=verified')
}
