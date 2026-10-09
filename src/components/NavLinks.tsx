'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const NAV = [
  { href: '/opportunities', label: 'งานแข่ง & ทุน' },
  { href: '/teams', label: 'หาทีม & Co-founder' },
]

export default function NavLinks() {
  const path = usePathname()
  return (
    <nav aria-label="Main" className="main-nav">
      {NAV.map((n) => {
        const active = path === n.href || path.startsWith(`${n.href}/`)
        return (
          <Link key={n.href} href={n.href} className={`nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
            {n.label}
          </Link>
        )
      })}
    </nav>
  )
}
