'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PasswordInput from './PasswordInput'

export default function SetPasswordForm({ next }: { next: string }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('รหัสผ่านอย่างน้อย 8 ตัวอักษร')
    setBusy(true)
    setError(null)
    const { error } = await createClient().auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error.code === 'same_password' ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม' : error.code === 'weak_password' ? 'รหัสผ่านง่ายเกินไป ลองใช้รหัสที่ยาวขึ้น' : error.message)
    setDone(true)
    setTimeout(() => window.location.assign(next), 1200)
  }

  if (done) return <div className="alert alert-ok">ตั้งรหัสผ่านเรียบร้อย ✓ กำลังพาไปต่อ…</div>
  return (
    <form onSubmit={submit} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="pw">รหัสผ่านใหม่</label>
        <PasswordInput id="pw" value={password} onChange={setPassword} autoComplete="new-password" />
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
        {busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่าน'}
      </button>
    </form>
  )
}
