'use client'
import { useState } from 'react'
import type { AuthError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { IconInfo } from './icons'

// All sign-in calls run in the browser: Supabase Auth rate-limits per IP, so each visitor
// spends their own quota instead of everyone sharing the Vercel server's IP.

type Mode = 'email' | 'signin' | 'signup'

function message(err: AuthError | Error): string {
  const code = (err as AuthError).code
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit|seconds/i.test(err.message))
    return 'มีการขอถี่เกินไป กรุณารอ 1 นาทีแล้วลองใหม่'
  if (code === 'invalid_credentials') return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง — ถ้าเคยเข้าด้วย Google หรือรหัสทางอีเมล ให้ใช้วิธีเดิม'
  if (code === 'user_already_exists') return 'อีเมลนี้มีบัญชีแล้ว ลองเข้าสู่ระบบแทน'
  if (code === 'email_not_confirmed') return 'ยังไม่ได้ยืนยันอีเมล — ใช้ “เข้าด้วยรหัสทางอีเมล” เพื่อยืนยันและเข้าสู่ระบบ'
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

export function GoogleButton({ next, label = 'Continue with Google' }: { next: string; label?: string }) {
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
        {busy ? 'กำลังไปที่ Google…' : label}
      </button>
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  )
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  )
}

/** Password input with a show/hide toggle. */
function PasswordField({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-field">
      <input
        id="pw"
        type={show ? 'text' : 'password'}
        required
        minLength={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="input"
        placeholder={autoComplete === 'new-password' ? 'อย่างน้อย 8 ตัวอักษร' : 'รหัสผ่านของคุณ'}
      />
      <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={show}>
        <EyeIcon off={show} />
      </button>
    </div>
  )
}

const HEADINGS: Record<Mode, [string, string]> = {
  signin: ['ยินดีต้อนรับกลับมา', 'เข้าสู่ระบบเพื่อไปต่อ'],
  signup: ['สร้างบัญชีใหม่', 'ฟรี ใช้เวลาไม่ถึง 1 นาที'],
  email: ['เข้าสู่ระบบด้วยรหัสทางอีเมล', 'ไม่ต้องใช้รหัสผ่าน — เราจะส่งรหัส 6 หลักไปที่อีเมลของคุณ'],
}

export default function LoginForm({ next, google, initialMode = 'signin' }: { next: string; google: boolean; initialMode?: 'signin' | 'signup' }) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const redirectTo = () => `${window.location.origin}/login?next=${encodeURIComponent(next)}`
  const switchTo = (m: Mode) => (setMode(m), setError(null))

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
      <form onSubmit={verify} className="auth-form">
        <div className="auth-head">
          <h1>เช็กอีเมลของคุณ</h1>
          <p>
            ส่งรหัส 6 หลักไปที่ <b>{codeSentTo}</b> แล้ว — กรอกรหัส หรือกดปุ่มในอีเมล (ดูในโฟลเดอร์ Spam/Promotions ด้วย)
          </p>
        </div>
        <div className="auth-field">
          <label htmlFor="otp">รหัสจากอีเมล</label>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="input otp-input"
            placeholder="••••••"
          />
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? 'กำลังตรวจสอบ…' : 'ยืนยันรหัส'}
        </button>
        <button type="button" className="auth-link" onClick={() => (setCodeSentTo(null), setCode(''), setError(null))}>
          ใช้อีเมลอื่น / ส่งรหัสใหม่
        </button>
      </form>
    )
  }

  const [title, sub] = HEADINGS[mode]
  return (
    <div className="auth-form">
      {mode !== 'email' && (
        <div className="segmented auth-tabs" role="tablist" aria-label="เข้าสู่ระบบหรือสมัครสมาชิก">
          <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => switchTo('signin')}>
            เข้าสู่ระบบ
          </button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => switchTo('signup')}>
            สมัครสมาชิก
          </button>
        </div>
      )}
      <div className="auth-head">
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {google && mode !== 'email' && (
        <>
          <GoogleButton next={next} label={mode === 'signup' ? 'สมัครด้วย Google' : 'เข้าสู่ระบบด้วย Google'} />
          <div className="divider">หรือใช้อีเมล</div>
        </>
      )}
      <form onSubmit={submit} className="auth-form" noValidate>
        <div className="auth-field">
          <label htmlFor="em">อีเมล</label>
          <input id="em" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@student.mahidol.ac.th" />
          {mode === 'signup' && (
            <span className="auth-hint">
              <IconInfo size={14} />
              อีเมล @student.mahidol.ac.th ได้ป้าย “Mahidol verified”
            </span>
          )}
        </div>
        {mode !== 'email' && (
          <div className="auth-field">
            <div className="auth-label-row">
              <label htmlFor="pw">รหัสผ่าน</label>
              {mode === 'signin' && (
                <button type="button" className="auth-link" onClick={() => switchTo('email')}>
                  ลืมรหัสผ่าน?
                </button>
              )}
            </div>
            <PasswordField value={password} onChange={setPassword} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {mode === 'email' ? (busy ? 'กำลังส่ง…' : 'ส่งรหัสไปที่อีเมล') : mode === 'signin' ? (busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ') : busy ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
        </button>
      </form>
      {mode === 'email' ? (
        <button type="button" className="auth-link center" onClick={() => switchTo('signin')}>
          ← กลับไปเข้าสู่ระบบด้วยรหัสผ่าน
        </button>
      ) : (
        <p className="auth-switch">
          {mode === 'signin' ? 'ยังไม่มีบัญชี? ' : 'มีบัญชีอยู่แล้ว? '}
          <button type="button" className="auth-link" onClick={() => switchTo(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
          </button>
          {mode === 'signin' && (
            <>
              {' · '}
              <button type="button" className="auth-link" onClick={() => switchTo('email')}>
                เข้าด้วยรหัสทางอีเมล
              </button>
            </>
          )}
        </p>
      )}
    </div>
  )
}
