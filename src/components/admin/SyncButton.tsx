'use client'
import { useState, useTransition } from 'react'
import { syncNow } from '@/app/actions/imports'

export default function SyncButton() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null)
  return (
    <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
      <button type="button" className="btn btn-primary" disabled={pending} onClick={() => start(async () => setMsg(await syncNow()))}>
        {pending ? 'กำลังดึงข้อมูล…' : 'ซิงก์ตอนนี้'}
      </button>
      {msg?.ok && <span style={{ fontSize: 13, color: 'var(--ok)' }}>{msg.ok}</span>}
      {msg?.error && <span style={{ fontSize: 13, color: 'var(--danger)', maxWidth: 360, textAlign: 'right' }}>{msg.error}</span>}
    </div>
  )
}
