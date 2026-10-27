'use client'
import { useEffect, useRef, useState } from 'react'
import type { AuthError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { env } from '@/lib/env'
import { IconInfo } from './icons'
import PasswordInput from './PasswordInput'

// All sign-in calls run in the browser: Supabase Auth rate-limits per IP, so each visitor
// spends their own quota instead of everyone sharing the Vercel server's IP.

type Mode = 'signin' | 'signup' | 'reset'

function message(err: AuthError | Error): string {
  const code = (err as AuthError).code
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit|seconds/i.test(err.message))
    return 'มีการขอถี่เกินไป กรุณารอ 1 นาทีแล้วลองใหม่'
  if (code === 'invalid_credentials') return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง — ถ้ายังไม่เคยตั้งรหัสผ่าน (เคยเข้าด้วย Google หรือรหัสทางอีเมล) กด “ลืมรหัสผ่าน?” เพื่อตั้งรหัส'
  if (code === 'user_already_exists') return 'อีเมลนี้มีบัญชีแล้ว ลองเข้าสู่ระบบแทน'
  if (code === 'otp_expired' || /expired|invalid/i.test(err.message)) return 'รหัสไม่ถูกต้องหรือหมดอายุ'
  if (code === 'weak_password') return 'รหัสผ่านง่ายเกินไป ลองใช้รหัสที่ยาวขึ้น'
  if (code === 'same_password') return 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม'
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

// Google refuses sign-in inside in-app webviews (disallowed_useragent).
const IN_APP = /\bLine\/|FBAN|FBAV|Instagram|; wv\)/i

type GoogleIdentity = {
  accounts: {
    id: {
      initialize(options: { client_id: string; nonce: string; callback: (res: { credential: string }) => void; ux_mode: 'popup' }): void
      renderButton(el: HTMLElement, options: Record<string, string | number>): void
    }
  }
}

let gisScript: Promise<GoogleIdentity> | null = null
function loadGoogleIdentity() {
  gisScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve((window as unknown as { google: GoogleIdentity }).google)
    s.onerror = () => {
      gisScript = null
      s.remove()
      reject(new Error('Google Identity Services failed to load'))
    }
    document.head.appendChild(s)
  })
  return gisScript
}

/** Google gets the SHA-256 of the nonce inside the ID token; Supabase gets the raw one and compares. */
async function makeNonce(): Promise<[raw: string, hashed: string]> {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return [raw, Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')]
}

/**
 * Google's own button (Google Identity Services): the account chooser runs on our origin, so it says
 * "mahidolstartup.site" instead of our Supabase host, and the ID token goes straight to Supabase.
 * Falls back to the Supabase OAuth redirect when there's no client id, inside in-app browsers,
 * or when Google's script can't load.
 */
export function GoogleButton({ next, signup = false }: { next: string; signup?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'loading' | 'gis' | 'redirect'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!env.googleClientId || IN_APP.test(navigator.userAgent)) return setMode('redirect')
    let cancelled = false
    Promise.all([loadGoogleIdentity(), makeNonce()])
      .then(([google, [raw, hashed]]) => {
        if (cancelled || !box.current) return
        google.accounts.id.initialize({
          client_id: env.googleClientId,
          nonce: hashed,
          ux_mode: 'popup',
          callback: async ({ credential }) => {
            setBusy(true)
            setError(null)
            const { error } = await createClient().auth.signInWithIdToken({ provider: 'google', token: credential, nonce: raw })
            if (error) {
              setBusy(false)
              setError(message(error))
            } else done(next)
          },
        })
        google.accounts.id.renderButton(box.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: signup ? 'signup_with' : 'signin_with',
          locale: 'th',
          width: Math.min(400, box.current.offsetWidth), // Google's max
        })
        setMode('gis')
      })
      .catch(() => !cancelled && setMode('redirect'))
    return () => {
      cancelled = true
    }
  }, [next, signup])

  const redirect = async () => {
    setError(null)
    if (/\bLine\//i.test(navigator.userAgent)) {
      const u = new URL(window.location.href)
      u.searchParams.set('openExternalBrowser', '1') // LINE opens this in Safari/Chrome
      window.location.assign(u.toString())
      return
    }
    if (IN_APP.test(navigator.userAgent)) {
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
      {mode === 'redirect' ? (
        <button type="button" className="btn btn-outline btn-lg btn-block" style={{ color: 'var(--navy)', gap: 12 }} onClick={redirect} disabled={busy}>
          <GoogleIcon />
          {busy ? 'กำลังไปที่ Google…' : signup ? 'สมัครด้วย Google' : 'เข้าสู่ระบบด้วย Google'}
        </button>
      ) : (
        <div ref={box} aria-busy={mode === 'loading' || busy} style={{ minHeight: 44, display: 'flex', justifyContent: 'center', opacity: busy ? 0.55 : 1, pointerEvents: busy ? 'none' : undefined }} />
      )}
      {busy && mode === 'gis' && <p className="auth-hint" style={{ justifyContent: 'center' }}>กำลังเข้าสู่ระบบ…</p>}
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  )
}

const HEADINGS: Record<Mode, [string, string]> = {
  signin: ['ยินดีต้อนรับกลับมา', 'เข้าสู่ระบบเพื่อไปต่อ'],
  signup: ['สร้างบัญชีใหม่', 'ฟรี ใช้เวลาไม่ถึง 1 นาที'],
  reset: ['ลืมรหัสผ่าน', 'กรอกอีเมลของบัญชี เราจะส่งรหัส 6 หลักไปให้ตั้งรหัสผ่านใหม่'],
}
const RESEND_AFTER = 60 // seconds

export default function LoginForm({ next, google, initialMode = 'signin' }: { next: string; google: boolean; initialMode?: 'signin' | 'signup' }) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState<{ to: string; kind: 'signup' | 'reset' } | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const redirectTo = () => `${window.location.origin}/login?next=${encodeURIComponent(next)}`
  const switchTo = (m: Mode) => (setMode(m), setError(null))

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

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

  /** Sends (or re-sends) the 6-digit code and shows the code screen. */
  const sendCode = async (to: string, kind: 'signup' | 'reset') => {
    const sb = createClient()
    const { error } =
      kind === 'signup' ? await sb.auth.resend({ type: 'signup', email: to, options: { emailRedirectTo: redirectTo() } }) : await sb.auth.resetPasswordForEmail(to, { redirectTo: redirectTo() })
    if (error) throw error
    setSent({ to, kind })
    setCode('')
    setPassword('')
    setCooldown(RESEND_AFTER)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return setError('อีเมลไม่ถูกต้อง')
    if (mode !== 'reset' && password.length < 8) return setError('รหัสผ่านอย่างน้อย 8 ตัวอักษร')
    const sb = createClient()
    run(async () => {
      if (mode === 'reset') return sendCode(addr, 'reset')
      if (mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email: addr, password })
        // Signed up earlier but never entered the code: send a fresh one.
        if (error && (error as AuthError).code === 'email_not_confirmed') return sendCode(addr, 'signup')
        if (error) throw error
        return done(next)
      }
      const { data, error } = await sb.auth.signUp({ email: addr, password, options: { emailRedirectTo: redirectTo() } })
      if (error) throw error
      // With email confirmation on, an existing account comes back with no identities and no email is sent.
      if (data.user && !data.user.identities?.length) throw new Error('อีเมลนี้มีบัญชีอยู่แล้ว — เข้าสู่ระบบ หรือกด “ลืมรหัสผ่าน?” เพื่อตั้งรหัสใหม่')
      if (data.session) return done(next)
      setSent({ to: addr, kind: 'signup' })
      setCode('')
      setPassword('')
      setCooldown(RESEND_AFTER)
    })
  }

  const verify = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sent) return
    if (!/^\d{6,8}$/.test(code.trim())) return setError('รหัสต้องเป็นตัวเลข 6 หลัก')
    if (sent.kind === 'reset' && password.length < 8) return setError('รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร')
    run(async () => {
      const sb = createClient()
      const { error } = await sb.auth.verifyOtp({ email: sent.to, token: code.trim(), type: sent.kind === 'reset' ? 'recovery' : 'email' })
      if (error) throw error
      if (sent.kind === 'reset') {
        const { error: pwError } = await sb.auth.updateUser({ password })
        if (pwError) throw pwError
      }
      done(next)
    })
  }

  if (sent) {
    const reset = sent.kind === 'reset'
    return (
      <form onSubmit={verify} className="auth-form">
        <div className="auth-head">
          <h1>{reset ? 'ตั้งรหัสผ่านใหม่' : 'ยืนยันอีเมล'}</h1>
          <p>
            ส่งรหัส 6 หลักไปที่ <b>{sent.to}</b> แล้ว — ดูในโฟลเดอร์ Spam/Promotions ด้วย
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
        {reset && (
          <div className="auth-field">
            <label htmlFor="pw">รหัสผ่านใหม่</label>
            <PasswordInput id="pw" value={password} onChange={setPassword} autoComplete="new-password" />
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? 'กำลังตรวจสอบ…' : reset ? 'ตั้งรหัสผ่านและเข้าสู่ระบบ' : 'ยืนยันและเข้าสู่ระบบ'}
        </button>
        <p className="auth-switch">
          ไม่ได้รับรหัส?{' '}
          <button type="button" className="auth-link" disabled={busy || cooldown > 0} onClick={() => run(() => sendCode(sent.to, sent.kind))}>
            {cooldown > 0 ? `ส่งใหม่ได้ใน ${cooldown} วิ` : 'ส่งรหัสอีกครั้ง'}
          </button>
          {' · '}
          <button type="button" className="auth-link" onClick={() => (setSent(null), setCode(''), setError(null))}>
            เปลี่ยนอีเมล
          </button>
        </p>
      </form>
    )
  }

  const [title, sub] = HEADINGS[mode]
  return (
    <div className="auth-form">
      {mode !== 'reset' && (
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
      {google && mode !== 'reset' && (
        <>
          <GoogleButton next={next} signup={mode === 'signup'} />
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
        {mode !== 'reset' && (
          <div className="auth-field">
            <div className="auth-label-row">
              <label htmlFor="pw">รหัสผ่าน</label>
              {mode === 'signin' && (
                <button type="button" className="auth-link" onClick={() => switchTo('reset')}>
                  ลืมรหัสผ่าน?
                </button>
              )}
            </div>
            <PasswordInput id="pw" value={password} onChange={setPassword} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {mode === 'reset' ? (busy ? 'กำลังส่ง…' : 'ส่งรหัสไปที่อีเมล') : mode === 'signin' ? (busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ') : busy ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
        </button>
      </form>
      {mode === 'reset' ? (
        <button type="button" className="auth-link center" onClick={() => switchTo('signin')}>
          ← กลับไปเข้าสู่ระบบ
        </button>
      ) : (
        <p className="auth-switch">
          {mode === 'signin' ? 'ยังไม่มีบัญชี? ' : 'มีบัญชีอยู่แล้ว? '}
          <button type="button" className="auth-link" onClick={() => switchTo(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
          </button>
        </p>
      )}
    </div>
  )
}
