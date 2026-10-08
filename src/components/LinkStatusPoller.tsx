'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Refreshes the page as soon as the webhook has linked LINE (step 3: “ระบบจะเชื่อมให้อัตโนมัติ”),
 * or — with `until="friend"` — as soon as the user has added the OA as a friend.
 */
export default function LinkStatusPoller({ until = 'linked' }: { until?: 'linked' | 'friend' }) {
  const router = useRouter()
  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(async () => {
      if (Date.now() - started > 20 * 60_000) return clearInterval(timer)
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/line/link-status', { cache: 'no-store' })
        const body = (await res.json()) as { linked: boolean; friend?: boolean }
        if (until === 'friend' ? body.friend : body.linked) {
          clearInterval(timer)
          router.refresh()
        }
      } catch {}
    }, 3000)
    return () => clearInterval(timer)
  }, [router, until])
  return null
}
