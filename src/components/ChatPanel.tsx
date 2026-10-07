'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { sendMessageAction } from '@/app/actions/messaging'
import { createClient } from '@/lib/supabase/client'
import { IconFile, IconLock, IconPaperclip, IconSend } from './icons'

type Msg = {
  id: string
  mine: boolean
  kind: 'text' | 'system'
  body: string
  attachment: { name: string; url: string } | null
  time: string
  day: string | null
}

export default function ChatPanel({
  conversationId,
  messages,
  canSend,
  lockedReason,
  header,
}: {
  conversationId: string
  messages: Msg[]
  canSend: boolean
  lockedReason: string | null
  header: React.ReactNode
}) {
  const router = useRouter()
  const bodyRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [optimistic, setOptimistic] = useState<string | null>(null)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [messages.length, optimistic])

  // Live updates: any new row in this conversation → re-render from the server (sanitised).
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`conv-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () =>
        router.refresh(),
      )
      .subscribe()
    const onFocus = () => router.refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
    }
  }, [conversationId, router])

  useEffect(() => setOptimistic(null), [messages.length])

  const submit = () => {
    if (!text.trim() && !file) return
    const fd = new FormData()
    fd.set('conversationId', conversationId)
    fd.set('body', text)
    if (file) fd.set('file', file)
    setOptimistic(text || (file ? `📎 ${file.name}` : ''))
    setText('')
    setFile(null)
    setError(null)
    start(async () => {
      const res = await sendMessageAction(fd)
      if (res.error) {
        setError(res.error)
        setOptimistic(null)
      }
      router.refresh()
    })
  }

  return (
    <>
      <div className="chat-body" ref={bodyRef}>
        {header}
        {messages.map((m) => (
          <div key={m.id} className="stack" style={{ gap: 12 }}>
            {m.day && <span className="system-line">{m.day}</span>}
            {m.kind === 'system' ? (
              <span className="system-line">{m.body}</span>
            ) : (
              <div className="stack" style={{ gap: 6, alignSelf: m.mine ? 'flex-end' : 'flex-start', alignItems: m.mine ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
                {m.body && <span className={m.mine ? 'bubble-out' : 'bubble-in'} style={{ maxWidth: 'min(68vw, 520px)' }}>{m.body}</span>}
                {m.attachment && (
                  <a href={m.attachment.url} target="_blank" rel="noopener" className="attach">
                    <span style={{ display: 'inline-flex', color: 'var(--brand)' }}>
                      <IconFile size={18} />
                    </span>
                    {m.attachment.name}
                  </a>
                )}
                <span className="bubble-time">{m.time}</span>
              </div>
            )}
          </div>
        ))}
        {optimistic && (
          <span className="bubble-out" style={{ opacity: 0.6 }}>
            {optimistic}
          </span>
        )}
      </div>
      <div className="chat-input">
        {canSend ? (
          <form
            ref={formRef}
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <label className="sq-btn" style={{ background: 'transparent', cursor: 'pointer' }} aria-label="แนบไฟล์" title="แนบไฟล์ (ไม่เกิน 10 MB)">
              <IconPaperclip size={20} />
              <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <label htmlFor="msg" className="sr-only">
              พิมพ์ข้อความ
            </label>
            <input id="msg" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={file ? `แนบ ${file.name}` : 'พิมพ์ข้อความ…'} autoComplete="off" maxLength={2000} />
            <button type="submit" aria-label="ส่ง" className="search-go" style={{ width: 44, height: 44, borderRadius: 10 }} disabled={pending}>
              <IconSend size={18} />
            </button>
          </form>
        ) : (
          <div className="row muted" style={{ gap: 8, fontSize: 14, justifyContent: 'center', padding: '6px 0' }}>
            <IconLock size={16} />
            {lockedReason}
          </div>
        )}
        {error && (
          <div className="alert alert-error" style={{ marginTop: 8 }}>
            {error}
          </div>
        )}
      </div>
    </>
  )
}
