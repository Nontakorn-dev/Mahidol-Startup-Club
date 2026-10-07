import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24, textAlign: 'center' }}>
      <h1 style={{ fontSize: 48, margin: 0 }}>404</h1>
      <p className="muted">ไม่พบหน้านี้ หรือถูกลบไปแล้ว</p>
      <Link href="/" className="btn btn-primary btn-pill">
        กลับหน้าแรก
      </Link>
    </div>
  )
}
