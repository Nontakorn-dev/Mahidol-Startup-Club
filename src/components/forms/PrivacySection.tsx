'use client'
import Link from 'next/link'
import { useState } from 'react'
import Switch from '../Switch'
import { IconBell } from '../icons'

export default function PrivacySection({ defaultAnonymous, lineLinked, num = 3 }: { defaultAnonymous: boolean; lineLinked: boolean; num?: number }) {
  const [anon, setAnon] = useState(defaultAnonymous)
  return (
    <section>
      <div className="step-title">
        <span className="step-num yellow">{num}</span>
        <h2>ความเป็นส่วนตัวและการแจ้งเตือน</h2>
      </div>
      <div className="toggle-row yellow">
        <span className="txt">
          <b>ไม่เปิดเผยชื่อผู้โพสต์</b>
          <span>ชื่อจริงจะแสดงเมื่อคุณตอบรับคำขอเท่านั้น</span>
        </span>
        <Switch checked={anon} onChange={setAnon} label="ไม่เปิดเผยชื่อผู้โพสต์" name="anonymous" />
      </div>
      <div className="toggle-row" style={{ fontSize: 14 }}>
        <span style={{ display: 'inline-flex', color: 'var(--brand)' }}>
          <IconBell size={18} />
        </span>
        <span style={{ flex: 1 }}>แจ้งเตือนผ่าน LINE เมื่อมีคนสนใจ</span>
        {lineLinked ? (
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ok)' }}>เชื่อมแล้ว</span>
        ) : (
          <Link href="/settings/notifications#line" style={{ fontSize: 13, fontWeight: 600 }}>
            เชื่อม LINE →
          </Link>
        )}
      </div>
    </section>
  )
}
