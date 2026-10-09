'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconDashboard, IconMegaphone, IconPeople, IconSparkle, IconTrophy, IconUser } from '../icons'

type Item = { href: string; label: string; icon: (p: { size?: number }) => React.ReactNode; exact?: boolean; badge?: 'imports' | 'posts' }

const ITEMS: Item[] = [
  { href: '/admin', label: 'ภาพรวม', icon: IconDashboard, exact: true },
  { href: '/admin/events', label: 'งานแข่ง & ทุน', icon: IconTrophy },
  { href: '/admin/imports', label: 'นำเข้างาน', icon: IconSparkle, badge: 'imports' },
  { href: '/admin/community', label: 'ทีม & โปรไฟล์', icon: IconPeople, badge: 'posts' },
  { href: '/admin/users', label: 'ผู้ใช้', icon: IconUser },
  { href: '/admin/broadcasts', label: 'ประกาศข่าวสาร', icon: IconMegaphone },
]

export default function AdminNav({ newPosts, pendingImports = 0, mobile }: { newPosts: number; pendingImports?: number; mobile?: boolean }) {
  const path = usePathname()
  return (
    <nav aria-label="Admin" className={mobile ? undefined : 'admin-nav'}>
      {ITEMS.map(({ href, label, icon: Icon, exact, badge }) => {
        const active = exact ? path === href : path.startsWith(href)
        const n = badge === 'imports' ? pendingImports : badge === 'posts' ? newPosts : 0
        return (
          <Link key={href} href={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
            {!mobile && (
              <span style={{ display: 'inline-flex' }}>
                <Icon size={20} />
              </span>
            )}
            {label}
            {n > 0 && (
              <span className="n" style={mobile ? { minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--orange)', color: '#fff', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : undefined}>
                {n}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
