'use client'
import { useState } from 'react'

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
export default function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-field">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        required
        minLength={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="input"
        placeholder={placeholder ?? (autoComplete === 'new-password' ? 'อย่างน้อย 8 ตัวอักษร' : 'รหัสผ่านของคุณ')}
      />
      <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={show}>
        <EyeIcon off={show} />
      </button>
    </div>
  )
}
