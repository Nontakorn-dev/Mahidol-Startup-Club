'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { startConversation } from '@/app/actions/messaging'
import Switch from './Switch'
import { IconClose } from './icons'

export type ContactKind = 'message' | 'intro' | 'join' | 'invite'

type Props = {
  targetType: 'profile' | 'seeker' | 'team' | 'cofounder'
  targetId: string
  kind: ContactKind
  label: string
  targetName: string
  loggedIn: boolean
  variant?: 'primary' | 'outline'
  className?: string
  style?: React.CSSProperties
  myTeams?: { id: string; name: string }[]
  icon?: React.ReactNode
}

const TITLES: Record<ContactKind, string> = {
  message: 'ส่งข้อความ',
  intro: 'ขอทำความรู้จัก',
  join: 'สนใจร่วมทีม',
  invite: 'ชวนเข้าทีม',
}

const PLACEHOLDERS: Record<ContactKind, string> = {
  message: 'สวัสดีครับ/ค่ะ เห็นประกาศแล้วสนใจ อยากคุยรายละเอียดเพิ่ม',
  intro: 'แนะนำตัวสั้นๆ ว่าคุณเป็นใคร ถนัดอะไร และทำไมถึงสนใจ',
  join: 'เล่าว่าคุณถนัดอะไร และอยากช่วยทีมเรื่องไหน',
  invite: 'เล่าว่าทีมกำลังทำอะไร และทำไมถึงอยากชวนคนนี้',
}

export default function ContactButton(p: Props) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const [state, action, pending] = useActionState(startConversation, null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const cls = `btn btn-pill ${p.variant === 'outline' ? 'btn-outline-brand' : 'btn-primary'} ${p.className ?? ''}`
  if (!p.loggedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(path)}`} className={cls} style={p.style}>
        {p.icon}
        {p.label}
      </Link>
    )
  }
  const noTeams = p.kind === 'invite' && !p.myTeams?.length
  return (
    <>
      <button type="button" className={cls} style={p.style} onClick={() => setOpen(true)}>
        {p.icon}
        {p.label}
      </button>
      {open && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="contact-title">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 id="contact-title">{TITLES[p.kind]}</h2>
              <button type="button" className="sq-btn" aria-label="ปิด" onClick={() => setOpen(false)}>
                <IconClose />
              </button>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              ถึง <b style={{ color: 'var(--navy)' }}>{p.targetName}</b>
              {p.kind === 'intro' && ' — ชื่อจริงของทั้งสองฝ่ายจะแสดงเมื่ออีกฝ่ายตอบรับ'}
            </p>
            {noTeams ? (
              <div className="alert alert-info">
                คุณยังไม่มีประกาศทีมที่เปิดอยู่ —{' '}
                <Link href="/teams/new">สร้างประกาศชวนคนเข้าทีม</Link> ก่อน แล้วค่อยกลับมาชวน
              </div>
            ) : (
              <form action={action} className="stack" style={{ gap: 14 }}>
                <input type="hidden" name="targetType" value={p.targetType} />
                <input type="hidden" name="targetId" value={p.targetId} />
                <input type="hidden" name="kind" value={p.kind} />
                {p.kind === 'invite' && (
                  <div className="field">
                    <label htmlFor="teamId">ชวนเข้าทีมไหน</label>
                    <select id="teamId" name="teamId" className="select" defaultValue={p.myTeams![0].id}>
                      {p.myTeams!.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="message">ข้อความ</label>
                  <textarea id="message" name="message" className="textarea" rows={4} maxLength={1000} required placeholder={PLACEHOLDERS[p.kind]} />
                </div>
                {(p.kind === 'message' || p.kind === 'intro' || p.kind === 'join') && (
                  <div className="toggle-row yellow">
                    <span className="txt">
                      <b>ส่งแบบไม่ระบุชื่อ</b>
                      <span>อีกฝ่ายจะเห็นแค่คณะและชั้นปี จนกว่าจะตอบรับคำขอ</span>
                    </span>
                    <Switch checked={anonymous} onChange={setAnonymous} label="ส่งแบบไม่ระบุชื่อ" name="anonymous" />
                  </div>
                )}
                {state?.error && <div className="alert alert-error">{state.error}</div>}
                <div className="form-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
                    ยกเลิก
                  </button>
                  <button type="submit" className="btn btn-orange" disabled={pending}>
                    {pending ? 'กำลังส่ง…' : 'ส่ง'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
