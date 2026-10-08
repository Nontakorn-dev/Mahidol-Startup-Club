'use client'
import { useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { DONE_EVENT } from './NavProgress'

/** Submit button for server-action forms: shows a spinner and blocks double clicks while pending. */
export default function SubmitButton({ children, className = '', disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus()
  const was = useRef(false)
  useEffect(() => {
    if (was.current && !pending) window.dispatchEvent(new Event(DONE_EVENT))
    was.current = pending
  }, [pending])
  return (
    <button type="submit" {...rest} className={`${className} ${pending ? 'is-pending' : ''}`} disabled={disabled || pending} aria-busy={pending || undefined}>
      {pending && <span className="btn-spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}
