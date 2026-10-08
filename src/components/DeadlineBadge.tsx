'use client'
import { useEffect, useState } from 'react'
import { msLeft, timeLeftLabel, urgency, type Urgency } from '@/lib/format'
import { IconCalendar } from './icons'

const LABEL_PREFIX: Partial<Record<Urgency, string>> = { today: 'ปิดวันนี้ · ' }

function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/**
 * Live countdown to the real closing moment. Colour shows urgency:
 * red ≤ 24 h · orange ≤ 3 days · yellow ≤ 7 days · blue later · grey closed.
 * Server renders the same text (suppressHydrationWarning absorbs the second of drift).
 */
export default function DeadlineBadge({ closesAt, openNote, size = 'md' }: { closesAt: string | null; openNote?: string | null; size?: 'sm' | 'md' }) {
  const [now, setNow] = useState(() => Date.now())
  const ms = msLeft(closesAt, now)
  useEffect(() => {
    if (ms === null || ms <= 0) return
    const every = ms < 3_600_000 ? 1_000 : 30_000
    const t = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(t)
  }, [ms === null || ms <= 0, ms !== null && ms < 3_600_000]) // eslint-disable-line react-hooks/exhaustive-deps

  if (ms === null) {
    return (
      <span className={`dl-badge normal ${size}`}>
        <IconCalendar size={size === 'sm' ? 13 : 15} />
        {openNote || 'เปิดรับสมัครอยู่'}
      </span>
    )
  }
  const u = urgency(closesAt, now)
  const text = ms > 0 && ms < 3_600_000 ? `ปิดใน ${hms(ms)}` : `${LABEL_PREFIX[u] ?? ''}${timeLeftLabel(ms)}`
  return (
    <span className={`dl-badge ${u} ${size}`} suppressHydrationWarning title={u === 'closed' ? 'ปิดรับสมัครแล้ว' : 'นับถอยหลังถึงเวลาปิดรับจริง'}>
      {u !== 'closed' && u !== 'normal' && <span className="dl-dot" aria-hidden="true" />}
      <span suppressHydrationWarning>{text}</span>
    </span>
  )
}
