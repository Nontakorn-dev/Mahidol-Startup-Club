'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toggleSaveEvent } from '@/app/actions/events'
import { IconBookmark, IconExternal, IconShare } from './icons'

export function ApplyButton({ eventId, url, closed, style }: { eventId: string; url: string | null; closed: boolean; style?: React.CSSProperties }) {
  if (closed) {
    return (
      <span className="btn btn-lg" aria-disabled="true" style={{ flex: 1, background: '#CBD5E1', color: '#fff', ...style }}>
        ปิดรับสมัครแล้ว
      </span>
    )
  }
  if (!url) {
    return (
      <span className="btn btn-lg" aria-disabled="true" style={{ flex: 1, background: '#CBD5E1', color: '#fff', ...style }}>
        ลิงก์สมัครเร็วๆ นี้
      </span>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      className="btn btn-orange btn-lg"
      style={{ flex: 1, fontSize: 17, boxShadow: '0 10px 24px -10px rgba(249,115,22,0.6)', ...style }}
      onClick={() => navigator.sendBeacon?.(`/api/events/${eventId}/track`)}
    >
      สมัครเลย
      <IconExternal size={16} />
    </a>
  )
}

export function SaveButton({ eventId, initial, loggedIn, compact }: { eventId: string; initial: boolean; loggedIn: boolean; compact?: boolean }) {
  const [saved, setSaved] = useState(initial)
  const [pending, start] = useTransition()
  const path = usePathname()
  const style = { minHeight: 54, borderRadius: 14, background: '#fff', border: '1px solid var(--border-4)', color: 'var(--navy-2)' }
  if (!loggedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(path)}`} className="btn" style={style} aria-label="บันทึก">
        <IconBookmark />
        {!compact && 'บันทึก'}
      </Link>
    )
  }
  return (
    <button
      type="button"
      className="btn"
      style={{ ...style, color: saved ? 'var(--brand)' : 'var(--navy-2)' }}
      aria-pressed={saved}
      aria-label={saved ? 'ยกเลิกบันทึก' : 'บันทึก'}
      title={saved ? 'บันทึกแล้ว — เราจะเตือนก่อนปิดรับ 3 วัน' : 'บันทึกไว้ และรับการเตือนก่อนปิดรับ'}
      disabled={pending}
      onClick={() => {
        // Optimistic: flip now, settle on the server's answer (or roll back on failure).
        const before = saved
        setSaved(!before)
        start(async () => {
          try {
            const res = await toggleSaveEvent(eventId)
            setSaved(typeof res.saved === 'boolean' ? res.saved : before)
          } catch {
            setSaved(before)
          }
        })
      }}
    >
      <IconBookmark filled={saved} />
      {!compact && (saved ? 'บันทึกแล้ว' : 'บันทึก')}
    </button>
  )
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label="แชร์"
      title="แชร์"
      className="btn"
      style={{ width: 54, minHeight: 54, padding: 0, borderRadius: 14, background: '#fff', border: '1px solid var(--border-4)', color: 'var(--navy-2)', position: 'relative' }}
      onClick={async () => {
        const url = location.href
        if (navigator.share) {
          try {
            await navigator.share({ title, url })
          } catch {}
        } else {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        }
      }}
    >
      <IconShare />
      {copied && <span className="toast">คัดลอกลิงก์แล้ว</span>}
    </button>
  )
}
