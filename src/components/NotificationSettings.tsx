'use client'
import { useState, useTransition } from 'react'
import { unlinkLine } from '@/app/actions/profile'

export function UnlinkLineButton() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <button
        type="button"
        className="unlink-link"
        disabled={pending}
        onClick={() => {
          if (!confirm('ยกเลิกการเชื่อม LINE?\n\nคุณจะไม่ได้รับแจ้งเตือนทาง LINE อีก และต้องกดเชื่อมใหม่หากต้องการใช้งาน')) return
          start(async () => {
            const res = await unlinkLine()
            if (res.error) setError(res.error)
          })
        }}
      >
        {pending ? 'กำลังยกเลิก…' : 'ยกเลิกการเชื่อม LINE'}
      </button>
      {error && (
        <span className="alert alert-error" style={{ width: '100%' }}>
          {error}
        </span>
      )}
    </>
  )
}
