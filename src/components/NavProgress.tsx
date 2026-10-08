'use client'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

// Thin bar at the top that starts the moment a link is clicked or a form is submitted, so the
// page never feels frozen on a slow connection. It finishes when the URL changes, or when a
// SubmitButton reports its action is done (`msc:done`), with a safety timeout.

export const DONE_EVENT = 'msc:done'

export default function NavProgress() {
  const pathname = usePathname()
  const search = useSearchParams()
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const finish = () => {
    if (timer.current) clearTimeout(timer.current)
    setState((s) => (s === 'running' ? 'done' : s))
    timer.current = setTimeout(() => setState('idle'), 300)
  }

  // URL changed → navigation finished.
  useEffect(finish, [pathname, search])

  useEffect(() => {
    const start = () => {
      if (timer.current) clearTimeout(timer.current)
      setState('running')
      timer.current = setTimeout(finish, 15_000)
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest('a')
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin) return
      // Same page (only the hash differs) → no navigation.
      if (url.pathname === location.pathname && url.search === location.search) return
      start()
    }
    const onSubmit = (e: SubmitEvent) => {
      if (!e.defaultPrevented) start()
    }
    const onDone = () => finish()
    document.addEventListener('click', onClick, true)
    document.addEventListener('submit', onSubmit, true)
    window.addEventListener(DONE_EVENT, onDone)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('submit', onSubmit, true)
      window.removeEventListener(DONE_EVENT, onDone)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className={`nav-progress ${state}`} aria-hidden="true" />
}
