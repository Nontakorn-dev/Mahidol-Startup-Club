'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Lands on /login after Google (?code=…) or an email button (?token_hash=…) and creates the
 * Supabase session in the browser (PKCE verifier lives in this browser's cookies), then hands
 * off to /auth/after for the LINE-link / onboarding / `next` redirect.
 */
export default function AuthCompleter({ next, code, tokenHash, type, providerError }: { next: string; code?: string; tokenHash?: string; type?: string; providerError?: string }) {
  const [error, setError] = useState<string | null>(providerError ? 'ยกเลิกหรือเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่' : null)
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current || providerError) return
    ran.current = true
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      isSingleton: false,
      auth: { detectSessionInUrl: false },
    })
    ;(async () => {
      const { error } = code
        ? await sb.auth.exchangeCodeForSession(code)
        : await sb.auth.verifyOtp({ token_hash: tokenHash!, type: (type || 'email') as EmailOtpType })
      if (error) {
        // A link opened in a different browser than the one that asked for it has no PKCE verifier.
        setError(/verifier|both auth code/i.test(error.message) ? 'ลิงก์นี้ต้องเปิดในเบราว์เซอร์เดียวกับที่ขอ — หรือกรอกรหัส 6 หลักจากอีเมลแทน' : 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอใหม่')
        return
      }
      // "Reset password" email button: signed in — now pick the new password.
      const dest = type === 'recovery' ? `/settings/password?reset=1&next=${encodeURIComponent(next)}` : next
      window.location.replace(`/auth/after?next=${encodeURIComponent(dest)}`)
    })()
  }, [code, tokenHash, type, next, providerError])
  if (error) {
    return (
      <div className="stack" style={{ gap: 12 }}>
        <div className="alert alert-error">{error}</div>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-primary">
          กลับไปเข้าสู่ระบบ
        </Link>
      </div>
    )
  }
  return (
    <div className="row" style={{ gap: 10, justifyContent: 'center', padding: '24px 0', color: 'var(--brand)', fontWeight: 600 }}>
      <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-6.2-8.6" strokeLinecap="round" />
      </svg>
      กำลังเข้าสู่ระบบ…
    </div>
  )
}
