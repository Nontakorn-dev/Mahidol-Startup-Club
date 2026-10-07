'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Avatar from './Avatar'
import { NAV } from './NavLinks'
import { IconBell, IconChevronDown, IconDashboard, IconLine, IconLogout, IconUser } from './icons'

export default function UserMenu({
  name,
  avatarUrl,
  email,
  isAdmin,
  lineLinked,
}: {
  name: string
  avatarUrl: string | null
  email: string | null
  isAdmin: boolean
  lineLinked: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const path = usePathname()
  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])
  return (
    <div className="menu" ref={ref}>
      <button type="button" className="avatar-btn" aria-label="โปรไฟล์ของฉัน" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar name={name} src={avatarUrl} size={36} brand fontSize={15} />
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <div className="menu-head">
            <div style={{ fontWeight: 600 }}>{name}</div>
            {email && <div className="muted" style={{ fontSize: 13 }}>{email}</div>}
          </div>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="only-mobile" role="menuitem">
              {n.label}
            </Link>
          ))}
          <Link href="/me" role="menuitem">
            <IconUser size={18} /> โปรไฟล์และประกาศของฉัน
          </Link>
          <Link href="/settings/notifications" role="menuitem">
            <IconBell size={18} /> ตั้งค่าการแจ้งเตือน
          </Link>
          <Link href="/settings/notifications#line" role="menuitem">
            <span style={{ color: '#06C755', display: 'inline-flex' }}>
              <IconLine size={18} />
            </span>
            {lineLinked ? 'LINE เชื่อมแล้ว' : 'เชื่อม LINE'}
          </Link>
          {isAdmin && (
            <Link href="/admin" role="menuitem">
              <IconDashboard size={18} /> ผู้ดูแลระบบ
            </Link>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem" style={{ width: '100%' }}>
              <IconLogout size={18} /> ออกจากระบบ
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
