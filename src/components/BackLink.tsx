'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'

// "ย้อนกลับ" that returns to the page you actually came from (browser history) when you got here
// by clicking around this site; opened directly (shared link, LINE) it goes to `href` instead.

const CUR = 'msc:cur'
const PREV = 'msc:prev'

/** Remembers the previous in-site page for this tab (mounted once in the root layout). */
export function NavDepth() {
  const path = usePathname()
  useEffect(() => {
    try {
      const cur = sessionStorage.getItem(CUR)
      if (cur === path) return // same page (re-render / strict-mode double run)
      if (cur) sessionStorage.setItem(PREV, cur)
      sessionStorage.setItem(CUR, path)
    } catch {}
  }, [path])
  return null
}

export default function BackLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter()
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        let prev: string | null = null
        try {
          prev = sessionStorage.getItem(PREV)
        } catch {}
        if (prev && window.history.length > 1) {
          e.preventDefault()
          router.back()
        }
      }}
    >
      {children}
    </Link>
  )
}
