import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Works across browsers when the Supabase email template links to
// {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const token_hash = url.searchParams.get('token_hash')
  const type = (url.searchParams.get('type') || 'email') as EmailOtpType
  const next = url.searchParams.get('next') || '/'
  if (token_hash) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      const dest = type === 'email_change' ? '/settings/notifications?email=changed' : `/auth/after?next=${encodeURIComponent(next)}`
      return NextResponse.redirect(new URL(dest, url.origin))
    }
  }
  return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent('ลิงก์ไม่ถูกต้องหรือหมดอายุ'), url.origin))
}
