'use client'
import { useState } from 'react'
import type { AuthError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { IconInfo } from './icons'

// All sign-in calls run in the browser: Supabase Auth rate-limits per IP, so each visitor
// spends their own quota instead of everyone sharing the Vercel server's IP.

const linkBtn = { border: 0, background: 'none', color: 'var(--brand)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }
type Mode = 'email' | 'signin' | 'signup'

function message(err: AuthError | Error): string {
  const code = (err as AuthError).code
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit|seconds/i.test(err.message))
    return 'มีการขอถี่เกินไป กรุณารอ 1 นาทีแล้วลองใหม่'
  if (code === 'invalid_credentials') return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง (ถ้าเคยเข้าด้วย Google หรือรหัสทางอีเมล ให้ใช้วิธีเดิม)'
  if (code === 'user_already_exists') return 'อีเมลนี้มีบัญชีแล้ว ลองเข้าสู่ระบบแทน'
  if (code === 'email_not_confirmed') return 'ยังไม่ได้ยืนยันอีเมล — ใช้ “รับรหัสทางอีเมล” เพื่อยืนยันและเข้าสู่ระบบ'
  if (code === 'otp_expired' || /expired|invalid/i.test(err.message)) return 'รหัสไม่ถูกต้องหรือหมดอายุ'
  if (code === 'weak_password') return 'รหัสผ่านง่ายเกินไป ลองใช้รหัสที่ยาวขึ้น'
  return err.message
}

const done = (next: string) => window.location.assign(`/auth/after?next=${encodeURIComponent(next)}`)

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const start = async () => {
    setError(null)
    const ua = navigator.userAgent
    // Google refuses OAuth inside in-app webviews (disallowed_useragent).
    if (/\bLine\//i.test(ua)) {
      const u = new URL(window.location.href)
      u.searchParams.set('openExternalBrowser', '1') // LINE opens this in Safari/Chrome
      window.location.assign(u.toString())
      return
    }
    if (/FBAN|FBAV|Instagram|; wv\)/i.test(ua)) {
      setError('Google ไม่อนุญาตให้เข้าสู่ระบบในเบราว์เซอร์ของแอปนี้ — เปิดหน้านี้ใน Chrome/Safari หรือใช้อีเมลแทน')
      return
    }
    setBusy(true)
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) {
      setBusy(false)
      setError(message(error))
    }
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <button type="button" className="btn btn-outline btn-lg btn-block" style={{ color: 'var(--navy)', gap: 12 }} onClick={start} disabled={busy}>
        <GoogleIcon />
        {busy ? 'กำลังไปที่ Google…' : 'Continue with Google'}
      </button>
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  )
}

export default function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const redirectTo = () => `${window.location.origin}/login?next=${encodeURIComponent(next)}`

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(message(err as Error))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return setError('อีเมลไม่ถูกต้อง')
    if (mode !== 'email' && password.length < 8) return setError('รหัสผ่านอย่างน้อย 8 ตัวอักษร')
    const sb = createClient()
    run(async () => {
      if (mode === 'email') {
        const { error } = await sb.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } })
        if (error) throw error
        setCodeSentTo(addr)
      } else if (mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email: addr, password })
        if (error) throw error
        done(next)
      } else {
        const { data, error } = await sb.auth.signUp({ email: addr, password, options: { emailRedirectTo: redirectTo() } })
        if (error) throw error
        if (data.session) done(next)
        else setCodeSentTo(addr) // confirmation email carries the same 6-digit code
      }
    })
  }

  const verify = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{6,8}$/.test(code.trim())) return setError('รหัสต้องเป็นตัวเลข 6 หลัก')
    run(async () => {
      const { error } = await createClient().auth.verifyOtp({ email: codeSentTo!, token: code.trim(), type: 'email' })
      if (error) throw error
      done(next)
    })
  }

  if (codeSentTo) {
    return (
      <form onSubmit={verify} className="stack" style={{ gap: 10 }}>
        <div className="alert alert-ok" style={{ flexDirection: 'column', gap: 2 }}>
          <b>ส่งอีเมลไปที่ {codeSentTo} แล้ว</b>
          <span>กรอกรหัส 6 หลักจากอีเมล หรือกดปุ่มในอีเมล (ลองดูในโฟลเดอร์ Spam/Promotions ด้วย)</span>
        </div>
        <label htmlFor="otp" style={{ fontSize: 14, fontWeight: 600 }}>
          รหัสจากอีเมล
        </label>
        <input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="input"
          style={{ minHeight: 54, fontSize: 24, letterSpacing: '0.4em', textAlign: 'center' }}
          placeholder="••••••"
        />
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary" style={{ minHeight: 50, fontSize: 16 }} disabled={busy}>
          {busy ? 'กำลังตรวจสอบ…' : 'ยืนยันรหัส'}
        </button>
        <button type="button" style={linkBtn} onClick={() => (setCodeSentTo(null), setCode(''), setError(null))}>
          ใช้อีเมลอื่น / ส่งใหม่
        </button>
      </form>
    )
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <form onSubmit={submit} className="stack" style={{ gap: 10 }} noValidate>
        <label htmlFor="em" style={{ fontSize: 14, fontWeight: 600 }}>
          อีเมล
        </label>
        <input id="em" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" style={{ minHeight: 50 }} placeholder="you@student.mahidol.ac.th" />
        {mode !== 'email' && (
          <>
            <label htmlFor="pw" style={{ fontSize: 14, fontWeight: 600 }}>
              รหัสผ่าน
            </label>
            <input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="input" style={{ minHeight: 50 }} />
          </>
        )}
        <span className="row muted" style={{ fontSize: 13, gap: 8, alignItems: 'flex-start' }}>
          <span style={{ display: 'inline-flex', marginTop: 3 }}>
            <IconInfo size={16} />
          </span>
          ใช้อีเมล @student.mahidol.ac.th เพื่อรับป้าย “Mahidol verified”
        </span>
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary" style={{ minHeight: 50, fontSize: 16 }} disabled={busy}>
          {mode === 'email' ? (busy ? 'กำลังส่ง…' : 'รับรหัสเข้าสู่ระบบทางอีเมล') : mode === 'signin' ? (busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ') : busy ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
        </button>
      </form>
      <div className="row wrap" style={{ justifyContent: 'center', gap: 12 }}>
        {mode !== 'email' && (
          <button type="button" style={linkBtn} onClick={() => setMode('email')}>
            ใช้รหัสทางอีเมลแทน
          </button>
        )}
        {mode !== 'signin' && (
          <button type="button" style={linkBtn} onClick={() => setMode('signin')}>
            เข้าด้วยรหัสผ่าน
          </button>
        )}
        {mode !== 'signup' && (
          <button type="button" style={linkBtn} onClick={() => setMode('signup')}>
            สมัครด้วยรหัสผ่าน
          </button>
        )}
      </div>
    </div>
  )
}
