'use client'
import { useEffect } from 'react'

/** Moves on to the next step by itself after a moment (the button stays for slow devices). */
export default function AutoContinue({ href, delayMs = 1500 }: { href: string; delayMs?: number }) {
  useEffect(() => {
    const t = setTimeout(() => window.location.assign(href), delayMs)
    return () => clearTimeout(t)
  }, [href, delayMs])
  return (
    <span className="muted" style={{ fontSize: 13 }}>
      กำลังพาไปต่อ…
    </span>
  )
}
