'use client'
import { useState, useTransition } from 'react'
import { syncNow } from '@/app/actions/imports'

/** Sync every source (or one, with `source`) right now. */
export default function SyncButton({ source, label = 'ซิงก์ตอนนี้', small = false }: { source?: string; label?: string; small?: boolean }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null)
  const run = () =>
    start(async () => {
      const form = new FormData()
      if (source) form.set('source', source)
      setMsg(await syncNow(form))
    })
  return (
    <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
      <button type="button" className={`btn ${small ? 'btn-outline btn-sm' : 'btn-primary'}`} disabled={pending} onClick={run}>
        {pending ? 'กำลังดึงข้อมูล…' : label}
      </button>
      {msg?.ok && <span style={{ fontSize: 13, color: 'var(--ok)', whiteSpace: 'pre-line', textAlign: 'right' }}>{msg.ok}</span>}
      {msg?.error && <span style={{ fontSize: 13, color: 'var(--danger)', maxWidth: 380, textAlign: 'right', whiteSpace: 'pre-line' }}>{msg.error}</span>}
    </div>
  )
}
