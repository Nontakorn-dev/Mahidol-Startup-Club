'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { IconLine } from './icons'

/** When the site is opened inside LINE (e.g. from the OA rich menu), offer one-tap LINE login. */
export default function LineBrowserBanner() {
  const [inLine, setInLine] = useState(false)
  const path = usePathname()
  useEffect(() => {
    setInLine(/\bLine\//i.test(navigator.userAgent) || new URLSearchParams(location.search).get('src') === 'line')
  }, [])
  if (!inLine || path.startsWith('/login')) return null
  return (
    <div className="line-banner">
      <div className="container">
        <span style={{ display: 'inline-flex', color: '#06C755' }}>
          <IconLine size={20} />
        </span>
        <span style={{ flex: 1 }}>เปิดจาก LINE อยู่ — เข้าสู่ระบบด้วย LINE ได้ในแตะเดียว</span>
        <a href={`/api/auth/line/start?next=${encodeURIComponent(path)}`} className="btn btn-line btn-sm">
          เข้าสู่ระบบ
        </a>
      </div>
    </div>
  )
}
