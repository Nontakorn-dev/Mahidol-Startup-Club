'use client'
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { sendMessageAction } from '@/app/actions/messaging'
import { createClient } from '@/lib/supabase/client'
import type { RecommendedEvent } from '@/lib/types'
import {
  IconBack,
  IconCalendar,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconFile,
  IconHome,
  IconLock,
  IconPaperclip,
  IconPin,
  IconSend,
  IconSparkle,
  IconTrophy,
} from './icons'

type Msg = {
  id: string
  mine: boolean
  kind: 'text' | 'system'
  body: string
  attachment: { name: string; url: string } | null
  time: string
  day: string | null
}

type EmbeddedEventCard = {
  slug?: string
  title: string
  poster_url?: string | null
  summary?: string | null
  organizer?: string | null
  is_club?: boolean
  categoryLabel?: string
  deadlineLabel?: string
  benefit?: string | null
  matchReason?: string
}

const CARD_MARKER_RX = /\[\[EVENT_CARD:([\s\S]*?)\]\]/

function encodeEventCardMessage(card: EmbeddedEventCard): string {
  const payload = JSON.stringify({
    slug: card.slug || '',
    title: card.title,
    poster_url: card.poster_url || null,
    summary: card.summary ? card.summary.slice(0, 140) : null,
    organizer: card.organizer || null,
    is_club: Boolean(card.is_club),
    categoryLabel: card.categoryLabel || 'รายการแข่งขัน',
    deadlineLabel: card.deadlineLabel || 'เปิดรับสมัครอยู่',
    benefit: card.benefit || null,
    matchReason: card.matchReason || null,
  })
  return `🏆 ชวนลงแข่ง: ${card.title}\n[[EVENT_CARD:${payload}]]`
}

function parseEventCardMessage(body: string): { card: EmbeddedEventCard | null } {
  const match = body.match(CARD_MARKER_RX)
  if (!match) return { card: null }
  try {
    const parsed = JSON.parse(match[1]) as EmbeddedEventCard
    if (parsed && parsed.title) {
      return { card: parsed }
    }
  } catch {
    // ignore malformed payload
  }
  return { card: null }
}

const CHAT_CARD_CSS = `
.chat-invite-box.li-comp-tray {
  border-radius: 16px;
  background: #fff;
  border: 1.5px solid #D4E1F6;
  padding: 14px 16px;
  box-shadow: 0 10px 26px -18px rgba(0, 53, 173, 0.22);
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: none;
}
.chat-invite-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.chat-strip-controls {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.chat-strip-nav {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid #CFDDF6;
  background: #F6F9FE;
  color: var(--navy);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.15s;
}
.chat-strip-nav:hover {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
  transform: scale(1.05);
}
.li-tray-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid #D4E1F6;
  background: #F6F9FE;
  color: #465875;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.li-tray-toggle:hover {
  background: #EAF1FE;
  color: var(--brand);
}
.chat-rec-strip {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  scroll-snap-type: x mandatory;
  padding: 2px 2px 8px;
  scrollbar-width: thin;
}
.chat-rec-strip::-webkit-scrollbar {
  height: 6px;
}
.chat-rec-strip::-webkit-scrollbar-thumb {
  background: #C5D4EE;
  border-radius: 999px;
}
.chat-rec-card {
  flex: 0 0 288px !important;
  width: 288px !important;
  max-width: 288px !important;
  scroll-snap-align: start;
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  border: 1.5px solid #D5E2F6;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 8px 22px -14px rgba(0, 53, 173, 0.22);
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
  text-align: left;
}
.chat-rec-card:hover {
  transform: translateY(-3px);
  border-color: var(--brand);
  box-shadow: 0 16px 32px -14px rgba(0, 53, 173, 0.35);
}
.chat-rec-card-top {
  display: flex;
  gap: 12px;
  padding: 12px;
  align-items: flex-start;
}
.chat-rec-poster {
  flex: none;
  width: 76px;
  height: 98px;
  border-radius: 11px;
  overflow: hidden;
  background: linear-gradient(145deg, #0E2F6B 0%, #0035AD 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFC726;
  box-shadow: 0 6px 14px -6px rgba(10, 32, 74, 0.35);
}
.chat-rec-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  display: block;
}
.chat-rec-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chat-rec-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
}
.chat-rec-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: #EEF3FE;
  color: var(--brand);
}
.chat-rec-badge.gold {
  background: #FFF6D6;
  color: #946200;
}
.chat-rec-title {
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 14px;
  line-height: 1.32;
  color: var(--navy);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.chat-rec-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.35;
}
.chat-rec-meta span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chat-rec-meta b {
  color: var(--navy);
  font-weight: 600;
}
.chat-rec-foot {
  margin-top: auto;
  padding: 8px 12px;
  background: #F7FAFF;
  border-top: 1px solid #E6EEF9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.chat-rec-send-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 0;
  background: var(--brand);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 14px -6px rgba(0, 53, 173, 0.55);
  transition: filter 0.15s ease;
}
.chat-rec-card:hover .chat-rec-send-btn {
  filter: brightness(1.08);
}
.chat-rec-link {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-decoration: none;
}
.chat-rec-link:hover {
  color: var(--brand);
  text-decoration: underline;
}

/* Sent Event Card inside chat stream */
.chat-ev-card-bubble {
  width: min(84vw, 380px);
  border-radius: 22px;
  overflow: hidden;
  background: #fff;
  border: 1.5px solid #D3E1F8;
  box-shadow: 0 18px 42px -18px rgba(0, 42, 138, 0.32);
  display: flex;
  flex-direction: column;
  color: var(--navy);
}
.chat-ev-card-banner {
  position: relative;
  width: 100%;
  height: 196px;
  background: linear-gradient(145deg, #0D2958 0%, #0035AD 100%);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chat-ev-card-banner img.bg-blur {
  position: absolute;
  inset: -16px;
  width: calc(100% + 32px);
  height: calc(100% + 32px);
  object-fit: cover;
  filter: blur(18px) brightness(0.65);
  transform: scale(1.1);
}
.chat-ev-card-banner img.main-poster {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 20%;
  display: block;
}
.chat-ev-card-kicker {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: 999px;
  background: rgba(10, 32, 74, 0.82);
  backdrop-filter: blur(6px);
  color: #FFC726;
  font-size: 11.5px;
  font-weight: 700;
}
.chat-ev-card-cat {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: var(--brand);
  font-size: 11.5px;
  font-weight: 700;
}
.chat-ev-card-body {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.chat-ev-card-title {
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 17px;
  line-height: 1.32;
  color: var(--navy);
}
.chat-ev-card-summary {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.chat-ev-card-facts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 12px;
  background: #F5F8FE;
  font-size: 12.5px;
  color: var(--navy);
}
.chat-ev-card-facts > span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.chat-ev-card-actions {
  display: flex;
  gap: 8px;
  padding-top: 2px;
}
`

export default function ChatPanel({
  conversationId,
  targetProfileId,
  targetName,
  recommendedEvents,
  loggedIn = true,
  messages,
  canSend,
  lockedReason,
  header,
}: {
  conversationId: string | null
  targetProfileId?: string | null
  targetName?: string
  targetRole?: string | null
  recommendedEvents?: RecommendedEvent[]
  loggedIn?: boolean
  messages: Msg[]
  canSend: boolean
  lockedReason: string | null
  header: React.ReactNode
}) {
  const router = useRouter()
  const bodyRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const customInputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [optimistic, setOptimistic] = useState<string | null>(null)
  const [guestMessages, setGuestMessages] = useState<Msg[]>([])
  const [showTray, setShowTray] = useState(true)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customCompName, setCustomCompName] = useState('')

  const allMessages = [...messages, ...guestMessages]

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [allMessages.length, optimistic])

  // Live updates when a real conversationId exists
  useEffect(() => {
    if (!conversationId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`conv-${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_pings', filter: `conversation_id=eq.${conversationId}` }, () =>
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

  const scrollStrip = (dir: -1 | 1) => {
    stripRef.current?.scrollBy({ left: dir * 304, behavior: 'smooth' })
  }

  const dispatchMessage = (rawBody: string, attachFile: File | null = null) => {
    if (!rawBody.trim() && !attachFile) return
    const bodyText = rawBody.trim()

    if (!loggedIn) {
      const nowTime = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date())
      setGuestMessages((prev) => [
        ...prev,
        {
          id: `guest-${Date.now()}-${Math.random()}`,
          mine: true,
          kind: 'text',
          body: bodyText,
          attachment: null,
          time: nowTime,
          day: allMessages.length === 0 ? 'วันนี้' : null,
        },
      ])
      return
    }

    const fd = new FormData()
    if (conversationId) fd.set('conversationId', conversationId)
    if (targetProfileId) fd.set('targetProfileId', targetProfileId)
    fd.set('body', bodyText)
    if (attachFile) fd.set('file', attachFile)
    setOptimistic(bodyText || (attachFile ? `📎 ${attachFile.name}` : ''))
    setError(null)
    start(async () => {
      const res = await sendMessageAction(fd)
      if (res.error) {
        setError(res.error)
        setOptimistic(null)
        return
      }
      if (!conversationId && res.conversationId) {
        router.replace(`/inbox?c=${res.conversationId}`)
      } else {
        router.refresh()
      }
    })
  }

  // Clicking an Event Card sends ONLY the Event Card (no auto-generated greeting paragraph)
  const handleSendEventCard = (ev: RecommendedEvent) => {
    if (pending) return
    const encoded = encodeEventCardMessage({
      slug: ev.slug,
      title: ev.title,
      poster_url: ev.poster_url,
      summary: ev.summary,
      organizer: ev.organizer,
      is_club: ev.is_club,
      categoryLabel: ev.categoryLabel,
      deadlineLabel: ev.deadlineLabel,
      benefit: ev.benefit,
      matchReason: ev.matchReason,
    })
    dispatchMessage(encoded)
  }

  // Sending a custom competition card typed by the user
  const handleSendCustomCard = () => {
    const title = customCompName.trim()
    if (!title || pending) return
    const encoded = encodeEventCardMessage({
      title,
      categoryLabel: 'ชวนทำทีม / แข่งขัน',
      deadlineLabel: 'เปิดรับเพื่อนร่วมทีม',
    })
    setCustomCompName('')
    setShowCustomForm(false)
    dispatchMessage(encoded)
  }

  const submitPlain = () => {
    if (!text.trim() && !file) return
    const bodyText = text
    const f = file
    setText('')
    setFile(null)
    dispatchMessage(bodyText, f)
  }

  const hasRecs = Boolean(recommendedEvents && recommendedEvents.length > 0)
  const nextUrl = targetProfileId ? `/inbox?to=${targetProfileId}` : conversationId ? `/inbox?c=${conversationId}` : '/inbox'

  const renderMessageBubble = (rawBody: string, mine: boolean) => {
    const { card } = parseEventCardMessage(rawBody)
    if (!card) {
      return (
        <span className={mine ? 'bubble-out' : 'bubble-in'} style={{ maxWidth: 'min(68vw, 520px)' }}>
          {rawBody}
        </span>
      )
    }

    return (
      <div className={`chat-ev-card-bubble ${mine ? 'mine' : 'theirs'}`}>
        <div className="chat-ev-card-banner">
          {card.poster_url ? (
            <>
              <img src={card.poster_url} alt="" className="bg-blur" aria-hidden="true" />
              <img src={card.poster_url} alt={card.title} className="main-poster" />
            </>
          ) : (
            <IconTrophy size={46} />
          )}
          <span className="chat-ev-card-kicker">
            <IconTrophy size={13} />
            ชวนลงแข่งรายการนี้
          </span>
          {card.categoryLabel && <span className="chat-ev-card-cat">{card.categoryLabel}</span>}
        </div>

        <div className="chat-ev-card-body">
          <span className="chat-ev-card-title">{card.title}</span>
          {card.summary && <p className="chat-ev-card-summary">{card.summary}</p>}

          <div className="chat-ev-card-facts">
            {card.matchReason && (
              <span style={{ color: 'var(--brand)', fontWeight: 600 }}>
                <IconSparkle size={14} />
                {card.matchReason}
              </span>
            )}
            {card.benefit && (
              <span>
                <IconTrophy size={14} />
                <b>{card.benefit}</b>
              </span>
            )}
            {card.deadlineLabel && (
              <span>
                <IconCalendar size={14} />
                <span>{card.deadlineLabel}</span>
              </span>
            )}
            {card.organizer && (
              <span>
                <IconHome size={14} />
                <span>{card.organizer}</span>
              </span>
            )}
          </div>

          {card.slug && (
            <div className="chat-ev-card-actions">
              <Link
                href={`/opportunities/${card.slug}`}
                className="btn btn-primary btn-pill btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                ดูรายละเอียดงานแข่ง →
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CHAT_CARD_CSS }} />
      <div className="chat-body" ref={bodyRef}>
        {header}

        {(hasRecs || targetProfileId) && canSend && (
          <div className="chat-invite-box li-comp-tray">
            <div className="chat-invite-top">
              <div className="chat-invite-head">
                <span className="chat-invite-title">
                  <span className="ic">
                    <IconTrophy size={16} />
                  </span>
                  รายการแข่งที่เปิดรับ — แตะการ์ดเพื่อส่งชวน{targetName ? ` ${targetName}` : ''} ({recommendedEvents?.length || 0} รายการ)
                </span>
                <span className="chat-invite-sub">
                  แสดงครบทุกงานแข่งในแถวเดียว เลื่อนซ้าย-ขวาแล้วคลิกส่งเข้าแชททั้งการ์ดได้ทันที
                </span>
              </div>
              <div className="chat-strip-controls">
                {showTray && hasRecs && recommendedEvents!.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="chat-strip-nav"
                      aria-label="เลื่อนซ้าย"
                      onClick={() => scrollStrip(-1)}
                    >
                      <IconBack size={15} />
                    </button>
                    <button
                      type="button"
                      className="chat-strip-nav"
                      aria-label="เลื่อนขวา"
                      onClick={() => scrollStrip(1)}
                    >
                      <IconChevronRight size={16} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="li-tray-toggle"
                  onClick={() => setShowTray((v) => !v)}
                >
                  <span>{showTray ? 'ย่อการ์ด' : 'แสดงการ์ด'}</span>
                  <IconChevronDown size={14} />
                </button>
              </div>
            </div>

            {showTray && (
              <>
                {hasRecs && (
                  <div className="chat-rec-strip" ref={stripRef}>
                    {recommendedEvents!.map((ev) => (
                      <div
                        key={ev.id}
                        role="button"
                        tabIndex={0}
                        className="chat-rec-card"
                        onClick={() => handleSendEventCard(ev)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleSendEventCard(ev)
                          }
                        }}
                      >
                        <div className="chat-rec-card-top">
                          <span className="chat-rec-poster">
                            {ev.poster_url ? (
                              <img src={ev.poster_url} alt={ev.title} loading="lazy" decoding="async" />
                            ) : (
                              <IconTrophy size={28} />
                            )}
                          </span>
                          <span className="chat-rec-info">
                            <span className="chat-rec-tags">
                              {ev.is_club && (
                                <span className="chat-rec-badge gold">
                                  <IconPin size={11} /> จากชมรม
                                </span>
                              )}
                              <span className="chat-rec-badge">{ev.categoryLabel}</span>
                            </span>
                            <span className="chat-rec-title">{ev.title}</span>
                            <span className="chat-rec-meta">
                              {ev.matchReason && <b style={{ color: 'var(--brand)' }}>{ev.matchReason}</b>}
                              {ev.benefit && <span>🏆 {ev.benefit}</span>}
                              <span>📅 {ev.deadlineLabel}</span>
                            </span>
                          </span>
                        </div>

                        <div className="chat-rec-foot">
                          <Link
                            href={`/opportunities/${ev.slug}`}
                            className="chat-rec-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            ดูรายละเอียดงาน
                          </Link>
                          <span className="chat-rec-send-btn">
                            <IconSend size={12} />
                            ส่งการ์ดนี้
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className={`rec-event-item custom-opt ${showCustomForm ? 'active' : ''}`}
                  onClick={() => {
                    const nextState = !showCustomForm
                    setShowCustomForm(nextState)
                    if (nextState) {
                      setTimeout(() => customInputRef.current?.focus(), 40)
                    }
                  }}
                >
                  <span className="rec-ev-ic" style={{ background: '#EEF3FE', color: 'var(--brand)' }}>
                    <IconEdit size={16} />
                  </span>
                  <span className="rec-ev-txt">
                    <b>พิมพ์ชื่อรายการแข่ง หรือโปรเจกต์ของคุณเอง</b>
                    <span>กำหนดชื่องานแข่ง แฮกกาธอน หรือโปรเจกต์ที่อยากชวนทำเอง</span>
                  </span>
                  <span className="rec-ev-pick">{showCustomForm ? 'ซ่อน' : 'พิมพ์เอง'}</span>
                </button>

                {showCustomForm && (
                  <div className="chat-custom-comp row wrap" style={{ gap: 8, alignItems: 'center' }}>
                    <input
                      ref={customInputRef}
                      id="custom-comp-input"
                      type="text"
                      className="input"
                      style={{ flex: '1 1 220px' }}
                      value={customCompName}
                      placeholder="ระบุชื่อรายการแข่งขัน / โปรเจกต์ที่อยากชวน…"
                      onChange={(e) => setCustomCompName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSendCustomCard()
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-pill btn-sm"
                      style={{ minHeight: 44, padding: '0 18px' }}
                      disabled={!customCompName.trim() || pending}
                      onClick={handleSendCustomCard}
                    >
                      <IconSend size={14} /> ส่งการ์ดชวนแข่ง
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {allMessages.map((m) => (
          <div key={m.id} className="stack" style={{ gap: 12 }}>
            {m.day && <span className="system-line">{m.day}</span>}
            {m.kind === 'system' ? (
              <span className="system-line">{m.body}</span>
            ) : (
              <div
                className="stack"
                style={{
                  gap: 6,
                  alignSelf: m.mine ? 'flex-end' : 'flex-start',
                  alignItems: m.mine ? 'flex-end' : 'flex-start',
                  maxWidth: '100%',
                }}
              >
                {m.body && renderMessageBubble(m.body, m.mine)}
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
          <div className="stack" style={{ alignSelf: 'flex-end', alignItems: 'flex-end', opacity: 0.72 }}>
            {renderMessageBubble(optimistic, true)}
          </div>
        )}
      </div>

      <div className="chat-input">
        {!loggedIn && guestMessages.length > 0 && (
          <div className="chat-guest-bar">
            <span>ต้องการส่งการ์ดนี้แจ้งเตือนไปยัง LINE ของ {targetName || 'เพื่อน'} จริงๆ ใช่ไหม?</span>
            <Link href={`/login?next=${encodeURIComponent(nextUrl)}`} className="btn btn-primary btn-pill btn-sm">
              เข้าสู่ระบบเพื่อส่งจริง
            </Link>
          </div>
        )}
        {canSend ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitPlain()
            }}
          >
            {conversationId && (
              <label className="sq-btn" style={{ background: 'transparent', cursor: 'pointer' }} aria-label="แนบไฟล์" title="แนบไฟล์ (ไม่เกิน 10 MB)">
                <IconPaperclip size={20} />
                <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.docx,.pptx,.xlsx,.doc,.ppt,.xls,.txt,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
            <label htmlFor="msg" className="sr-only">
              พิมพ์ข้อความ
            </label>
            <input
              ref={inputRef}
              id="msg"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={file ? `แนบ ${file.name}` : `พิมพ์ข้อความพูดคุยกับ ${targetName || 'เพื่อนร่วมทีม'} ได้เลย…`}
              autoComplete="off"
              maxLength={2000}
            />
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
