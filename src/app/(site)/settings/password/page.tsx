import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import SetPasswordForm from '@/components/SetPasswordForm'
import { requireViewer } from '@/lib/auth'

export const metadata: Metadata = { title: 'ตั้งรหัสผ่าน' }
export const dynamic = 'force-dynamic'

/** Set or change the account password — also where the "reset password" email button lands. */
export default async function PasswordSettingsPage({ searchParams }: PageProps<'/settings/password'>) {
  const sp = await searchParams
  const viewer = await requireViewer('/settings/password')
  const rawNext = typeof sp.next === 'string' ? sp.next : '/me'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/me'
  const reset = sp.reset === '1'

  return (
    <div className="bg-soft" style={{ minHeight: '60vh' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 20px 96px' }} className="stack">
        <div style={{ marginBottom: 20 }}>
          <Crumbs back="/me" trail={[{ label: 'โปรไฟล์ของฉัน', href: '/me' }, { label: 'ตั้งรหัสผ่าน' }]} />
        </div>
        <div className="login-card" style={{ maxWidth: 'none' }}>
          <div className="auth-head">
            <h1>{reset ? 'ตั้งรหัสผ่านใหม่' : 'ตั้งรหัสผ่าน'}</h1>
            <p>
              สำหรับบัญชี <b>{viewer.email}</b> — ใช้คู่กับอีเมลนี้เพื่อเข้าสู่ระบบครั้งต่อไป
            </p>
          </div>
          <SetPasswordForm next={next} />
        </div>
      </div>
    </div>
  )
}
