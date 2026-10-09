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
        className="btn btn-outline"
        disabled={pending}
        onClick={() => {
          if (!confirm('ยกเลิกการเชื่อม LINE? คุณจะไม่ได้รับแจ้งเตือนทาง LINE อีก')) return
          start(async () => {
            const res = await unlinkLine()
            if (res.error) setError(res.error)
          })
        }}
      >
        ยกเลิกการเชื่อม
      </button>
      {error && (
        <span className="alert alert-error" style={{ width: '100%' }}>
          {error}
        </span>
      )}
    </>
  )
}
