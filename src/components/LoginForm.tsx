'use client'
import { useActionState, useState } from 'react'
import { passwordAuth, sendMagicLink } from '@/app/actions/auth'
import { IconInfo } from './icons'

export default function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<'link' | 'signin' | 'signup'>('link')
  const [linkState, linkAction, linkPending] = useActionState(sendMagicLink, null)
  const [pwState, pwAction, pwPending] = useActionState(passwordAuth, null)
  const sent = mode === 'link' ? linkState?.sent : pwState?.sent
  if (sent) {
    return (
      <div className="alert alert-ok" style={{ flexDirection: 'column', gap: 4 }}>
        <b>ส่งลิงก์ไปที่ {sent} แล้ว</b>
        <span>เปิดอีเมลแล้วกดลิงก์บนอุปกรณ์และเบราว์เซอร์เดียวกันนี้ (ลองดูในโฟลเดอร์ Spam ด้วย)</span>
      </div>
    )
  }
  const err = mode === 'link' ? linkState?.error : pwState?.error
  return (
    <div className="stack" style={{ gap: 10 }}>
      <form action={mode === 'link' ? linkAction : pwAction} className="stack" style={{ gap: 10 }}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="mode" value={mode} />
        <label htmlFor="em" style={{ fontSize: 14, fontWeight: 600 }}>
          อีเมล
        </label>
        <input id="em" name="email" type="email" required autoComplete="email" className="input" style={{ minHeight: 50 }} placeholder="you@student.mahidol.ac.th" />
        {mode !== 'link' && (
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
          {mode === 'link' ? (linkPending ? 'กำลังส่ง…' : 'ส่งลิงก์เข้าสู่ระบบทางอีเมล') : mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </button>
      </form>
      <div className="row wrap" style={{ justifyContent: 'center', gap: 12, fontSize: 13 }}>
        {mode !== 'link' && (
          <button type="button" className="btn-ghost" style={{ border: 0, background: 'none', color: 'var(--brand)', cursor: 'pointer' }} onClick={() => setMode('link')}>
            ใช้ลิงก์ทางอีเมลแทน
          </button>
        )}
        {mode !== 'signin' && (
          <button type="button" style={{ border: 0, background: 'none', color: 'var(--brand)', cursor: 'pointer' }} onClick={() => setMode('signin')}>
            เข้าด้วยรหัสผ่าน
          </button>
        )}
        {mode !== 'signup' && (
          <button type="button" style={{ border: 0, background: 'none', color: 'var(--brand)', cursor: 'pointer' }} onClick={() => setMode('signup')}>
            สมัครด้วยรหัสผ่าน
          </button>
        )}
      </div>
    </div>
  )
}
