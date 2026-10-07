'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { IconLine } from './icons'

/** Signed in but not linked, and browsing inside LINE: offer to link this LINE to the account. */
export default function LineBrowserBanner() {
  const [inLine, setInLine] = useState(false)
  const path = usePathname()
  useEffect(() => {
    setInLine(/\bLine\//i.test(navigator.userAgent) || new URLSearchParams(location.search).get('src') === 'line')
  }, [])
  if (!inLine || path.startsWith('/settings/notifications')) return null
  return (
    <div className="line-banner">
      <div className="container">
        <span style={{ display: 'inline-flex', color: '#06C755' }}>
          <IconLine size={20} />
        </span>
        <span style={{ flex: 1 }}>เปิดจาก LINE อยู่ — เชื่อม LINE นี้กับบัญชีของคุณ เพื่อรับข่าวสารผ่าน LINE OA</span>
        <a href="/settings/notifications#line" className="btn btn-line btn-sm">
          เชื่อมต่อ LINE
        </a>
      </div>
    </div>
  )
}
