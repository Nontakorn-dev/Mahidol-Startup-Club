import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Email link / signup confirmation.
//   ?code=...                 PKCE (same browser that requested the email)
//   ?token_hash=...&type=...  email template `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` (any browser)
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const next = url.searchParams.get('next') || '/'
  const supabase = await createClient()
  if (tokenHash) {
    const type = (url.searchParams.get('type') || 'email') as EmailOtpType
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) return NextResponse.redirect(new URL(`/auth/after?next=${encodeURIComponent(next)}`, url.origin))
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(`/auth/after?next=${encodeURIComponent(next)}`, url.origin))
  }
  const err = url.searchParams.get('error_description') || 'ลิงก์หมดอายุหรือถูกเปิดในเบราว์เซอร์อื่น กรุณาขอลิงก์ใหม่'
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err)}&next=${encodeURIComponent(next)}`, url.origin))
}
