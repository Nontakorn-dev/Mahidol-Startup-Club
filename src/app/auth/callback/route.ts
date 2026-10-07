import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Email magic-link / signup confirmation (PKCE): ?code=...
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/'
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(`/auth/after?next=${encodeURIComponent(next)}`, url.origin))
  }
  const err = url.searchParams.get('error_description') || 'ลิงก์หมดอายุหรือถูกเปิดในเบราว์เซอร์อื่น กรุณาขอลิงก์ใหม่'
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err)}&next=${encodeURIComponent(next)}`, url.origin))
}
