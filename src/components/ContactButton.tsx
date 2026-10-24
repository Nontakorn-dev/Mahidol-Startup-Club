'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { startConversation } from '@/app/actions/messaging'
import type { RecommendedEvent } from '@/lib/types'
import Switch from './Switch'
import { IconClose, IconSparkle, IconTrophy } from './icons'

export type ContactKind = 'message' | 'intro' | 'join' | 'invite'

type Props = {
  targetType: 'profile' | 'seeker' | 'team' | 'cofounder'
  targetId: string
  kind: ContactKind
  label: string
  targetName: string
  targetRole?: string | null
  loggedIn: boolean
  variant?: 'primary' | 'outline'
  className?: string
  style?: React.CSSProperties
  myTeams?: { id: string; name: string }[]
  recommendedEvents?: RecommendedEvent[]
  icon?: React.ReactNode
}

const TITLES: Record<ContactKind, string> = {
  message: 'ทักแชท / ชวนร่วมทีม',
  intro: 'ขอทำความรู้จัก',
  join: 'สนใจร่วมทีม',
  invite: 'ชวนเข้าทีม',
}

const PLACEHOLDERS: Record<ContactKind, string> = {
  message: 'สวัสดีครับ/ค่ะ เห็นโปรไฟล์แล้วสนใจ อยากชวนคุยหรือทำโปรเจกต์ด้วยกัน',
  intro: 'แนะนำตัวสั้นๆ ว่าคุณเป็นใคร ถนัดอะไร และทำไมถึงสนใจ',
  join: 'เล่าว่าคุณถนัดอะไร และอยากช่วยทีมเรื่องไหน',
  invite: 'เล่าว่าทีมกำลังทำอะไร และทำไมถึงอยากชวนคนนี้',
}

export default function ContactButton(p: Props) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [teamId, setTeamId] = useState<string>(p.myTeams?.[0]?.id ?? '')
  const [message, setMessage] = useState('')
  const [state, action, pending] = useActionState(startConversation, null)

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const hasRecs = Boolean(p.recommendedEvents && p.recommendedEvents.length > 0)
  const cls = `btn btn-pill ${p.variant === 'outline' ? 'btn-outline-brand' : 'btn-primary'} ${p.className ?? ''}`

  if (!p.loggedIn && !hasRecs) {
    return (
      <Link href={`/login?next=${encodeURIComponent(path)}`} className={cls} style={p.style}>
        {p.icon}
        {p.label}
      </Link>
    )
  }

  const pickRecommendedEvent = (ev: RecommendedEvent) => {
    if (selectedEventId === ev.id) {
      setSelectedEventId(null)
      return
    }
    setSelectedEventId(ev.id)
    setTeamId('')
    const roleHint = p.targetRole ? p.targetRole.split('·')[0].trim() : ''
    const draft = `สวัสดีครับ/ค่ะ เห็นโปรไฟล์${roleHint ? `ด้าน ${roleHint} ` : ''}แล้วน่าสนใจมาก อยากชวนมาร่วมทีมลงรายการ “${ev.title}” ด้วยกัน สนใจมาคุยไอเดียกันไหมครับ/คะ?`
    setMessage(draft)
  }

  const effectiveKind: ContactKind = p.kind === 'invite' && !teamId ? 'message' : p.kind

  return (
    <>
      <button type="button" className={cls} style={p.style} onClick={() => setOpen(true)}>
        {p.icon}
        {p.label}
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
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
                {p.targetRole && <span> · {p.targetRole}</span>}
                {p.kind === 'intro' && ' — ชื่อจริงของทั้งสองฝ่ายจะแสดงเมื่ออีกฝ่ายตอบรับ'}
              </p>

              <form action={action} className="stack" style={{ gap: 14 }}>
                <input type="hidden" name="targetType" value={p.targetType} />
                <input type="hidden" name="targetId" value={p.targetId} />
                <input type="hidden" name="kind" value={effectiveKind} />

                {p.myTeams && p.myTeams.length > 0 && (p.kind === 'invite' || p.targetType === 'profile') && (
                  <div className="field">
                    <label htmlFor="teamId">ชวนเข้าทีมของคุณ</label>
                    <select
                      id="teamId"
                      name="teamId"
                      className="select"
                      value={teamId}
                      onChange={(e) => {
                        setTeamId(e.target.value)
                        if (e.target.value) setSelectedEventId(null)
                      }}
                    >
                      <option value="">— ยังไม่ระบุทีม / ชวนทำทีมใหม่ —</option>
                      {p.myTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          ทีม {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {hasRecs && (
                  <div className="rec-events-box">
                    <div className="rec-events-head">
                      <span className="rec-events-title">
                        <span className="ic">
                          <IconSparkle size={16} />
                        </span>
                        รายการแนะนำที่ชวนไปลงด้วยกันได้
                      </span>
                      <span className="rec-events-sub">แตะเลือกรายการเพื่อร่างคำชวนอัตโนมัติ</span>
                    </div>
                    <div className="rec-events-list">
                      {p.recommendedEvents!.map((ev) => {
                        const active = selectedEventId === ev.id
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            className={`rec-event-item ${active ? 'active' : ''}`}
                            onClick={() => pickRecommendedEvent(ev)}
                          >
                            <span className="rec-ev-ic">
                              <IconTrophy size={16} />
                            </span>
                            <span className="rec-ev-txt">
                              <b>{ev.title}</b>
                              <span>{[ev.matchReason || ev.categoryLabel, ev.benefit || ev.deadlineLabel].filter(Boolean).join(' · ')}</span>
                            </span>
                            <span className="rec-ev-pick">{active ? '✓ เลือกแล้ว' : 'ชวนรายการนี้'}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="message">ข้อความ</label>
                  <textarea
                    id="message"
                    name="message"
                    className="textarea"
                    rows={4}
                    maxLength={1000}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={PLACEHOLDERS[p.kind]}
                  />
                </div>

                {(effectiveKind === 'message' || effectiveKind === 'intro' || effectiveKind === 'join') && (
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
                  {p.loggedIn ? (
                    <button type="submit" className="btn btn-orange" disabled={pending}>
                      {pending ? 'กำลังส่ง…' : 'ส่งข้อความ'}
                    </button>
                  ) : (
                    <Link href={`/login?next=${encodeURIComponent(path)}`} className="btn btn-orange">
                      เข้าสู่ระบบเพื่อส่ง
                    </Link>
                  )}
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
