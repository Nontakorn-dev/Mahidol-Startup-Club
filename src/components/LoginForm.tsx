'use client'
import { useActionState, useState } from 'react'
import { passwordAuth, sendMagicLink, verifyEmailCode } from '@/app/actions/auth'
import { IconInfo } from './icons'

const linkBtn = { border: 0, background: 'none', color: 'var(--brand)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }

export default function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<'email' | 'signin' | 'signup'>('email')
  const [linkState, linkAction, linkPending] = useActionState(sendMagicLink, null)
  const [codeState, codeAction, codePending] = useActionState(verifyEmailCode, null)
  const [pwState, pwAction, pwPending] = useActionState(passwordAuth, null)

  const sentTo = mode === 'email' ? (codeState?.sent ?? linkState?.sent) : pwState?.sent
  if (sentTo && mode === 'email') {
    return (
      <form action={codeAction} className="stack" style={{ gap: 10 }}>
        <div className="alert alert-ok" style={{ flexDirection: 'column', gap: 2 }}>
          <b>ส่งอีเมลไปที่ {sentTo} แล้ว</b>
          <span>กรอกรหัส 6 หลักจากอีเมลด้านล่าง หรือกดลิงก์ในอีเมล (ลองดูในโฟลเดอร์ Spam ด้วย)</span>
        </div>
        <input type="hidden" name="email" value={sentTo} />
        <input type="hidden" name="next" value={next} />
        <label htmlFor="otp" style={{ fontSize: 14, fontWeight: 600 }}>
          รหัสจากอีเมล
        </label>
        <input
          id="otp"
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6,8}"
          maxLength={8}
          required
          className="input"
          style={{ minHeight: 54, fontSize: 24, letterSpacing: '0.4em', textAlign: 'center' }}
          placeholder="••••••"
        />
        {codeState?.error && <div className="alert alert-error">{codeState.error}</div>}
        <button type="submit" className="btn btn-primary" style={{ minHeight: 50, fontSize: 16 }} disabled={codePending}>
          {codePending ? 'กำลังตรวจสอบ…' : 'ยืนยันรหัส'}
        </button>
        <button type="button" style={linkBtn} onClick={() => location.reload()}>
          ใช้อีเมลอื่น / ส่งใหม่
        </button>
      </form>
    )
  }
  if (sentTo) {
    return (
      <div className="alert alert-ok" style={{ flexDirection: 'column', gap: 4 }}>
        <b>ส่งลิงก์ยืนยันไปที่ {sentTo} แล้ว</b>
        <span>กดลิงก์ในอีเมลเพื่อยืนยันบัญชี แล้วระบบจะพากลับมาต่อ</span>
      </div>
    )
  }

  const err = mode === 'email' ? linkState?.error : pwState?.error
  return (
    <div className="stack" style={{ gap: 10 }}>
      <form action={mode === 'email' ? linkAction : pwAction} className="stack" style={{ gap: 10 }}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="mode" value={mode} />
        <label htmlFor="em" style={{ fontSize: 14, fontWeight: 600 }}>
          อีเมล
        </label>
        <input id="em" name="email" type="email" required autoComplete="email" className="input" style={{ minHeight: 50 }} placeholder="you@student.mahidol.ac.th" />
        {mode !== 'email' && (
          <>
            <label htmlFor="pw" style={{ fontSize: 14, fontWeight: 600 }}>
              รหัสผ่าน
            </label>
            <input id="pw" name="password" type="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="input" style={{ minHeight: 50 }} />
          </>
        )}
        <span className="row muted" style={{ fontSize: 13, gap: 8, alignItems: 'flex-start' }}>
          <span style={{ display: 'inline-flex', marginTop: 3 }}>
            <IconInfo size={16} />
          </span>
          ใช้อีเมล @student.mahidol.ac.th เพื่อรับป้าย “Mahidol verified”
        </span>
        {err && <div className="alert alert-error">{err}</div>}
        <button type="submit" className="btn btn-primary" style={{ minHeight: 50, fontSize: 16 }} disabled={linkPending || pwPending}>
          {mode === 'email' ? (linkPending ? 'กำลังส่ง…' : 'รับรหัส / ลิงก์เข้าสู่ระบบทางอีเมล') : mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
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
