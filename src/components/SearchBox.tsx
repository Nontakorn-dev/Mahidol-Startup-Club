'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { IconArrowRight } from './icons'

/** Natural-language intent box. Submits to /search (parsing: src/lib/ai/intent.ts). */
export default function SearchBox({
  defaultValue = '',
  placeholder = 'อยากทำอะไรต่อ? เช่น หาทีมลง TED Youth',
  maxWidth = 600,
  id = 'intent',
  scope,
}: {
  defaultValue?: string
  placeholder?: string
  maxWidth?: number
  id?: string
  scope?: 'teams' | 'cofounder' | 'events'
}) {
  const router = useRouter()
  const [q, setQ] = useState(defaultValue)
  const [pending, start] = useTransition()
  return (
    <form
      className="search-box"
      style={{ maxWidth }}
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const text = q.trim()
        if (!text) return
        start(() => router.push(`/search?q=${encodeURIComponent(text)}${scope ? `&scope=${scope}` : ''}`))
      }}
    >
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <input id={id} type="text" maxLength={200} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoComplete="off" enterKeyHint="search" />
      <button type="submit" className="search-go" aria-label="ค้นหา" disabled={pending}>
        {pending ? (
          <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-6.2-8.6" strokeLinecap="round" />
          </svg>
        ) : (
          <IconArrowRight />
        )}
      </button>
    </form>
  )
}
