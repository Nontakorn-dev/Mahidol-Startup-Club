'use client'
import Link from 'next/link'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24, textAlign: 'center', gap: 12 }}>
      <h1 style={{ fontSize: 32, margin: 0 }}>มีบางอย่างผิดพลาด</h1>
      <p className="muted" style={{ margin: 0 }}>ลองใหม่อีกครั้ง หรือกลับไปหน้าแรก</p>
      <div className="row" style={{ gap: 10 }}>
        <button type="button" className="btn btn-primary btn-pill" onClick={reset}>
          ลองใหม่
        </button>
        <Link href="/" className="btn btn-outline btn-pill">
          หน้าแรก
        </Link>
      </div>
    </div>
  )
}
