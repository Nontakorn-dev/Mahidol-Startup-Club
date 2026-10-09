'use client'
import Link from 'next/link'
import { useState } from 'react'
import Switch from '../Switch'
import { IconLine } from '../icons'

/** Last section of every post form: anonymity + where the contact line will appear. */
export default function PrivacySection({ defaultAnonymous, defaultContact, lineLinked, num = 3 }: { defaultAnonymous: boolean; defaultContact?: string | null; lineLinked: boolean; num?: number }) {
  const [anon, setAnon] = useState(defaultAnonymous)
  return (
    <section>
      <div className="step-title">
        <span className="step-num yellow">{num}</span>
        <h2>การติดต่อและความเป็นส่วนตัว</h2>
      </div>
      <div className="field">
        <label htmlFor="ct">
          ช่องทางติดต่อ <span className="opt">(ไม่บังคับ)</span>
        </label>
        <input id="ct" name="contact" className="input" maxLength={200} defaultValue={defaultContact ?? ''} placeholder="เช่น LINE ID: myteam, IG: @myteam, อีเมล" />
        <p className="help">แสดงในหน้ารายละเอียดของประกาศ เฉพาะสมาชิกที่เข้าสู่ระบบ — ถ้าไม่ระบุ ผู้สนใจจะติดต่อผ่านกล่องข้อความของเว็บไซต์</p>
      </div>
      <div className="toggle-row yellow">
        <span className="txt">
          <b>ไม่แสดงชื่อในประกาศ</b>
          <span>ระบบจะแสดงเฉพาะคณะและชั้นปี และเปิดเผยชื่อเมื่อคุณตอบรับคำขอติดต่อ</span>
        </span>
        <Switch checked={anon} onChange={setAnon} label="ไม่แสดงชื่อในประกาศ" name="anonymous" />
      </div>
      {!lineLinked && (
        <div className="toggle-row" style={{ fontSize: 14 }}>
          <span style={{ display: 'inline-flex', color: '#06C755' }}>
            <IconLine size={18} />
          </span>
          <span style={{ flex: 1 }}>เชื่อม LINE เพื่อรับแจ้งเตือนทันทีเมื่อมีผู้สนใจ</span>
          <Link href="/me#line" style={{ fontSize: 13, fontWeight: 600 }}>
            เชื่อม LINE →
          </Link>
        </div>
      )}
    </section>
  )
}
