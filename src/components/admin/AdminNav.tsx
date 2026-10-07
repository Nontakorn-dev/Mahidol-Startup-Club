'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconDashboard, IconMegaphone, IconPeople, IconTrophy, IconUser } from '../icons'

const ITEMS = [
  { href: '/admin', label: 'ภาพรวม', icon: IconDashboard, exact: true },
  { href: '/admin/events', label: 'งานแข่ง & ทุน', icon: IconTrophy },
  { href: '/admin/community', label: 'ทีม & โปรไฟล์', icon: IconPeople, badge: true },
  { href: '/admin/users', label: 'ผู้ใช้', icon: IconUser },
  { href: '/admin/broadcasts', label: 'ประกาศข่าวสาร', icon: IconMegaphone },
]

export default function AdminNav({ newPosts, mobile }: { newPosts: number; mobile?: boolean }) {
  const path = usePathname()
  return (
    <nav aria-label="Admin" className={mobile ? undefined : 'admin-nav'}>
      {ITEMS.map(({ href, label, icon: Icon, exact, badge }) => {
        const active = exact ? path === href : path.startsWith(href)
        return (
          <Link key={href} href={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
            {!mobile && (
              <span style={{ display: 'inline-flex' }}>
                <Icon size={20} />
              </span>
            )}
            {label}
            {badge && newPosts > 0 && (
              <span className="n" style={mobile ? { minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--orange)', color: '#fff', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : undefined}>
                {newPosts}
              </span>
            )}
          </Link>
        )
      })}
      {!mobile && (
        <Link href="/" style={{ marginTop: 12, fontSize: 14 }}>
          ← กลับไปหน้าเว็บ
        </Link>
      )}
    </nav>
  )
}
