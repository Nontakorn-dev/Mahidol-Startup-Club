'use client'
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Role } from '@/lib/constants'
import { hiResAvatar } from '@/lib/format'
import type { BuddyCard } from '@/lib/types'
import { EmptyState } from './Cards'
import {
  IconArrowRight,
  IconBack,
  IconBookmark,
  IconCheck,
  IconChevronRight,
  IconLayers,
  IconSparkle,
  IconTrophy,
  IconUserPlus,
} from './icons'

const FILTERS: { key: 'all' | Role; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'developer', label: 'Developer' },
  { key: 'ux_ui', label: 'Designer' },
  { key: 'business', label: 'Business' },
  { key: 'data_ai', label: 'Data / AI' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'hardware', label: 'Hardware' },
  { key: 'domain_expert', label: 'สายเฉพาะทาง' },
]

const SAVED_KEY = 'msc_saved_people_v1'
const FAN_OFFSETS = [-3, -2, -1, 0, 1, 2, 3] as const

const SHOWCASE_CSS = `
.section-title {
  margin: 0 !important;
  font-weight: 700 !important;
  font-size: clamp(28px, 3.6vw, 40px) !important;
  line-height: 1.18 !important;
  letter-spacing: -0.015em !important;
  color: var(--navy-2) !important;
}
.section .head-row {
  align-items: center !important;
}
.buddy-fan-viewport {
  --fan-x1: 240px;
  --fan-x2: 430px;
  --fan-x3: 560px;
  position: relative;
  width: 100%;
  margin: -16px auto -36px;
  padding: 20px 0 42px;
  overflow: hidden;
  touch-action: pan-y;
  user-select: none;
  cursor: grab;
}
.buddy-fan-viewport.is-dragging {
  cursor: grabbing;
}
@media (max-width: 1024px) {
  .buddy-fan-viewport {
    --fan-x1: clamp(120px, 21vw, 200px);
    --fan-x2: 280px;
    --fan-x3: 360px;
  }
  .buddy-fan-stage {
    grid-template-columns: min(368px, calc(100vw - 120px)) !important;
  }
  /* Show 3 cards (-1, 0, 1) cleanly on iPad portrait / tablet */
  .buddy-fan-slot[data-offset="-2"],
  .buddy-fan-slot[data-offset="2"] {
    opacity: 0 !important;
    pointer-events: none !important;
    transform: translate3d(0, 0, 0) scale(0.76) !important;
  }
}
@media (max-width: 640px) {
  .buddy-fan-viewport {
    --fan-x1: 54px;
    --fan-x2: 90px;
    --fan-x3: 110px;
    padding: 14px 0 34px;
  }
  .buddy-fan-stage {
    grid-template-columns: min(356px, calc(100vw - 68px)) !important;
  }
}
.buddy-fan-stage {
  display: grid !important;
  grid-template-columns: min(388px, calc(100vw - 48px)) !important;
  justify-content: center !important;
  align-items: stretch !important;
  position: relative;
  width: 100%;
}
.buddy-fan-slot {
  grid-area: 1 / 1 !important;
  width: 100% !important;
  max-width: 388px !important;
  min-width: 0;
  display: flex;
  flex-direction: column;
  will-change: transform, opacity, filter;
  transition:
    transform 0.52s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.44s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.44s cubic-bezier(0.22, 1, 0.36, 1);
}
.buddy-fan-slot > .buddy-card {
  flex: 1;
  width: 100%;
}
.buddy-fan-slot[data-offset="0"] {
  z-index: 10;
  opacity: 1;
  filter: none;
  transform: translate3d(var(--drag-x, 0px), 0, 0) scale(1);
}
.buddy-fan-viewport.is-dragging .buddy-fan-slot[data-offset="0"],
.buddy-fan-viewport.is-dragging .buddy-fan-slot[data-offset="-1"],
.buddy-fan-viewport.is-dragging .buddy-fan-slot[data-offset="1"] {
  transition: none;
}
.buddy-fan-slot[data-offset="-1"] {
  z-index: 7;
  opacity: 0.84;
  filter: brightness(0.95) saturate(0.92);
  transform: translate3d(calc(var(--fan-x1) * -1 + var(--drag-x, 0px) * 0.35), 0, 0) scale(0.88);
  cursor: pointer;
}
.buddy-fan-slot[data-offset="1"] {
  z-index: 7;
  opacity: 0.84;
  filter: brightness(0.95) saturate(0.92);
  transform: translate3d(calc(var(--fan-x1) + var(--drag-x, 0px) * 0.35), 0, 0) scale(0.88);
  cursor: pointer;
}
.buddy-fan-slot[data-offset="-2"] {
  z-index: 4;
  opacity: 0.42;
  filter: brightness(0.97) contrast(0.92);
  transform: translate3d(calc(var(--fan-x2) * -1), 0, 0) scale(0.76);
  cursor: pointer;
}
.buddy-fan-slot[data-offset="2"] {
  z-index: 4;
  opacity: 0.42;
  filter: brightness(0.97) contrast(0.92);
  transform: translate3d(var(--fan-x2), 0, 0) scale(0.76);
  cursor: pointer;
}
@media (max-width: 640px) {
  .buddy-fan-slot[data-offset="-1"] {
    opacity: 0.78;
    transform: translate3d(calc(var(--fan-x1) * -1), 0, 0) scale(0.9);
  }
  .buddy-fan-slot[data-offset="1"] {
    opacity: 0.78;
    transform: translate3d(var(--fan-x1), 0, 0) scale(0.9);
  }
  .buddy-fan-slot[data-offset="-2"],
  .buddy-fan-slot[data-offset="2"] {
    opacity: 0;
    pointer-events: none;
    transform: translate3d(0, 0, 0) scale(0.82);
  }
}
.buddy-fan-slot[data-offset="-3"] {
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(calc(var(--fan-x3) * -1), 0, 0) scale(0.65);
}
.buddy-fan-slot[data-offset="3"] {
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(var(--fan-x3), 0, 0) scale(0.65);
}
.buddy-fan-slot:not([data-offset="0"]) > .buddy-card {
  pointer-events: none;
  box-shadow: 0 18px 42px -18px rgba(10, 32, 74, 0.24);
}
.buddy-fan-slot[data-offset="0"] > .buddy-card {
  box-shadow: 0 28px 64px -18px rgba(0, 42, 138, 0.34), 0 8px 24px -8px rgba(10, 32, 74, 0.16);
}
.buddy-fan-slot[data-offset="-1"]:hover,
.buddy-fan-slot[data-offset="1"]:hover {
  opacity: 0.94;
  filter: brightness(0.99);
}
.buddy-hero {
  position: relative;
  width: 100%;
  height: 228px;
  overflow: hidden;
  background: linear-gradient(180deg, #9EC0F2 0%, #5E87CA 55%, #0F295A 100%);
}
.buddy-hero-foot {
  padding: 42px 20px 14px;
}
.buddy-name {
  font-size: 23px;
}
.buddy-body {
  padding: 15px 20px 18px;
  gap: 10px;
}
.buddy-match {
  font-size: 14px;
  line-height: 1.38;
}
.buddy-bio {
  font-size: 14px;
  line-height: 1.5;
  -webkit-line-clamp: 2;
}
.buddy-works {
  gap: 7px;
  margin-top: 0;
}
.buddy-work-ic {
  width: 34px;
  height: 34px;
  border-radius: 10px;
}
.buddy-work-txt b {
  font-size: 13.5px;
}
.buddy-work-txt span {
  font-size: 12px;
}
.buddy-actions {
  padding-top: 4px;
  gap: 10px;
}
.buddy-btn-main,
.buddy-btn-chat {
  min-height: 44px;
  font-size: 15px;
}
.buddy-controls {
  margin-top: 14px;
}

/* On mobile phones: keep the original full card height and spacing */
@media (max-width: 680px) {
  .buddy-hero {
    height: 276px;
  }
  .buddy-hero-foot {
    padding: 54px 22px 18px;
  }
  .buddy-name {
    font-size: 26px;
  }
  .buddy-body {
    padding: 20px 22px 22px;
    gap: 14px;
  }
  .buddy-match {
    font-size: 14.5px;
    line-height: 1.45;
  }
  .buddy-bio {
    font-size: 15px;
    line-height: 1.62;
  }
  .buddy-works {
    gap: 10px;
    margin-top: 2px;
  }
  .buddy-work-ic {
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }
  .buddy-work-txt b {
    font-size: 14.5px;
  }
  .buddy-work-txt span {
    font-size: 13px;
  }
  .buddy-actions {
    padding-top: 8px;
    gap: 12px;
  }
  .buddy-btn-main,
  .buddy-btn-chat {
    min-height: 50px;
    font-size: 16px;
  }
  .buddy-controls {
    margin-top: 22px;
  }
}

.buddy-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 22%;
  display: block;
  filter: url(#buddy-crisp) contrast(1.03) saturate(1.04);
  transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}
.buddy-fan-slot[data-offset="0"] .buddy-card:hover .buddy-photo {
  transform: scale(1.04);
}

/* Side arrows beside the card fan across all viewports */
.buddy-side-arrow {
  display: inline-flex !important;
  position: absolute;
  top: 48%;
  transform: translateY(-50%);
  z-index: 30;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 3px solid #fff !important;
  background: var(--brand) !important;
  color: #fff !important;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    0 14px 32px -6px rgba(0, 35, 115, 0.55),
    0 4px 12px rgba(10, 32, 74, 0.25) !important;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, filter 0.18s ease;
}
.buddy-side-arrow.left {
  left: 12px;
}
.buddy-side-arrow.right {
  right: 12px;
}
.buddy-side-arrow:hover {
  filter: brightness(1.1);
  transform: translateY(-50%) scale(1.08);
  box-shadow:
    0 18px 36px -6px rgba(0, 35, 115, 0.68),
    0 6px 16px rgba(10, 32, 74, 0.32) !important;
}
.buddy-side-arrow:active {
  transform: translateY(-50%) scale(0.93);
}
.buddy-controls {
  justify-content: center !important;
}
.buddy-controls .buddy-arrow {
  display: none !important;
}
@media (max-width: 640px) {
  .buddy-side-arrow {
    width: 46px;
    height: 46px;
    border-width: 2.5px !important;
  }
  .buddy-side-arrow.left {
    left: 6px;
  }
  .buddy-side-arrow.right {
    right: 6px;
  }
}
`

export default function PeopleShowcase({
  people,
  loggedIn,
}: {
  people: BuddyCard[]
  loggedIn: boolean
  myTeams?: { id: string; name: string }[]
}) {
  const [role, setRole] = useState<'all' | Role>('all')
  // Unbounded integer index so each virtual slot key (`${role}-${vIdx}`) stays mounted and glides smoothly
  const [idx, setIdx] = useState(0)
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const liveDragXRef = useRef(0)
  const didDragRef = useRef(false)
  const wheelLockRef = useRef(0)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY)
      if (raw) setSavedIds(JSON.parse(raw))
    } catch {
      // ignore storage errors
    }
  }, [])

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  const filtered = role === 'all' ? people : people.filter((p) => p.roles.includes(role))
  const count = filtered.length
  const safeIdx = count > 0 ? ((idx % count) + count) % count : 0

  const stepBy = (delta: number) => {
    if (count <= 1 || delta === 0) return
    setIdx((i) => i + delta)
  }

  const prev = () => stepBy(-1)
  const next = () => stepBy(1)

  const dotCount = Math.min(count, 7)
  const activeDot = count > 0 ? safeIdx % dotCount : 0

  const selectDot = (dotIndex: number) => {
    if (count <= 1 || dotIndex === activeDot) return
    stepBy(dotIndex - activeDot)
  }

  const selectRole = (nextRole: 'all' | Role) => {
    if (nextRole === role) return
    setRole(nextRole)
    setIdx(0)
    liveDragXRef.current = 0
    setDragX(0)
    setIsDragging(false)
  }

  const finishGesture = () => {
    if (!pointerStartRef.current) return
    const dx = liveDragXRef.current
    pointerStartRef.current = null
    liveDragXRef.current = 0
    setIsDragging(false)
    setDragX(0)
    if (dx < -28) next()
    else if (dx > 28) prev()
  }

  const activeOffsets =
    count === 1
      ? ([0] as const)
      : count === 2
        ? ([-1, 0, 1, 2] as const)
        : FAN_OFFSETS

  return (
    <div className="container section home-people">
      <style dangerouslySetInnerHTML={{ __html: SHOWCASE_CSS }} />
      {/* Subtle SVG unsharp mask filter to keep upscaled OAuth/profile photos crisp */}
      <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }} aria-hidden="true">
        <defs>
          <filter id="buddy-crisp">
            <feConvolveMatrix
              order="3"
              kernelMatrix="0 -0.28 0 -0.28 2.12 -0.28 0 -0.28 0"
              preserveAlpha="true"
            />
          </filter>
        </defs>
      </svg>

      <div className="head-row posts-head" style={{ marginBottom: 22 }}>
        <h2 className="section-title">หาเพื่อนร่วมทางที่ใช่</h2>
        <Link href="/people" className="cta-link">
          เครือข่าย
          <span className="arrow" aria-hidden="true">
            <IconArrowRight size={18} />
          </span>
        </Link>
      </div>

      <Link href="/people" className="cta-link posts-cta-block">
        เครือข่ายทั้งหมด
        <span className="arrow" aria-hidden="true">
          <IconArrowRight size={18} />
        </span>
      </Link>

      <div className="buddy-chips" role="tablist" aria-label="กรองตามสายทักษะ">
        {FILTERS.map((f) => {
          const active = role === f.key
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`buddy-chip ${active ? 'active' : ''}`}
              onClick={() => selectRole(f.key)}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {count === 0 ? (
        <EmptyState
          title={role === 'all' ? 'ยังไม่มีโปรไฟล์สมาชิกในเครือข่าย' : 'ยังไม่มีสมาชิกในสายนี้'}
          body={
            role === 'all'
              ? 'สร้างโปรไฟล์ของคุณเป็นคนแรก เพื่อให้เพื่อนร่วมทางค้นพบคุณ'
              : 'ลองดูสมาชิกในสายอื่น หรือกดดูทั้งหมด'
          }
          action={
            role === 'all' ? (
              <Link href={loggedIn ? '/me' : '/login?next=%2Fme'} className="btn btn-primary btn-pill">
                สร้างโปรไฟล์ของคุณ
              </Link>
            ) : (
              <button type="button" className="btn btn-primary btn-pill" onClick={() => selectRole('all')}>
                ดูสมาชิกทั้งหมด
              </button>
            )
          }
        />
      ) : (
        <>
          <div
            className={`buddy-fan-viewport ${isDragging ? 'is-dragging' : ''}`}
            style={{ '--drag-x': `${dragX}px` } as React.CSSProperties}
            /* MacBook Trackpad two-finger horizontal swipe */
            onWheel={(e) => {
              if (count <= 1) return
              if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 18) {
                const now = Date.now()
                if (now - wheelLockRef.current > 420) {
                  wheelLockRef.current = now
                  if (e.deltaX > 0) next()
                  else prev()
                }
              }
            }}
            /* Touch swipe for Phone & iPad */
            onTouchStart={(e) => {
              if (count <= 1) return
              const t = e.touches[0]
              if (!t) return
              pointerStartRef.current = { x: t.clientX, y: t.clientY }
              liveDragXRef.current = 0
              didDragRef.current = false
              setIsDragging(true)
            }}
            onTouchMove={(e) => {
              if (!pointerStartRef.current) return
              const t = e.touches[0]
              if (!t) return
              const dx = t.clientX - pointerStartRef.current.x
              const dy = t.clientY - pointerStartRef.current.y
              if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
                didDragRef.current = true
                liveDragXRef.current = dx
                setDragX(dx)
              }
            }}
            onTouchEnd={finishGesture}
            onTouchCancel={() => {
              pointerStartRef.current = null
              liveDragXRef.current = 0
              setIsDragging(false)
              setDragX(0)
            }}
            /* Mouse / Trackpad click-and-drag for MacBook & Desktop */
            onMouseDown={(e) => {
              if (count <= 1 || e.button !== 0) return
              pointerStartRef.current = { x: e.clientX, y: e.clientY }
              liveDragXRef.current = 0
              didDragRef.current = false
            }}
            onMouseMove={(e) => {
              if (!pointerStartRef.current) return
              const dx = e.clientX - pointerStartRef.current.x
              const dy = e.clientY - pointerStartRef.current.y
              if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
                didDragRef.current = true
                liveDragXRef.current = dx
                setIsDragging(true)
                setDragX(dx)
              }
            }}
            onMouseUp={finishGesture}
            onMouseLeave={() => {
              if (pointerStartRef.current) finishGesture()
            }}
            onClickCapture={(e) => {
              if (didDragRef.current) {
                e.preventDefault()
                e.stopPropagation()
                didDragRef.current = false
              }
            }}
          >
            {count > 1 && (
              <>
                <button
                  type="button"
                  className="buddy-side-arrow left"
                  onClick={(e) => {
                    e.stopPropagation()
                    prev()
                  }}
                  aria-label="คนก่อนหน้า"
                >
                  <IconBack size={22} />
                </button>
                <button
                  type="button"
                  className="buddy-side-arrow right"
                  onClick={(e) => {
                    e.stopPropagation()
                    next()
                  }}
                  aria-label="คนถัดไป"
                >
                  <IconChevronRight size={22} />
                </button>
              </>
            )}

            <div key={role} className="buddy-fan-stage">
              {activeOffsets.map((offset) => {
                const vIdx = idx + offset
                const personIdx = ((vIdx % count) + count) % count
                const person = filtered[personIdx]

                return (
                  <div
                    key={`${role}-${vIdx}`}
                    className="buddy-fan-slot"
                    data-offset={offset}
                    style={{ gridArea: '1 / 1', width: '100%', maxWidth: 388 }}
                    onClick={offset !== 0 ? () => stepBy(offset) : undefined}
                    aria-hidden={offset !== 0 ? true : undefined}
                  >
                    <BuddyCardItem
                      person={person}
                      saved={savedIds.includes(person.id)}
                      onToggleSave={() => toggleSave(person.id)}
                      loggedIn={loggedIn}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {count > 1 && (
            <div className="buddy-controls">
              <div className="buddy-dots" role="tablist" aria-label="เลื่อนดูสมาชิก">
                {Array.from({ length: dotCount }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === activeDot}
                    aria-label={`คนที่ ${i + 1}`}
                    className={`buddy-dot ${i === activeDot ? 'active' : ''}`}
                    onClick={() => selectDot(i)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function BuddyCardItem({
  person,
  saved,
  onToggleSave,
  loggedIn,
}: {
  person: BuddyCard
  saved: boolean
  onToggleSave: () => void
  loggedIn: boolean
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const avatarSrc = hiResAvatar(person.avatar_url)

  return (
    <article className="buddy-card">
      <div className="buddy-hero">
        {avatarSrc && !imgFailed ? (
          <img
            src={avatarSrc}
            alt={person.name}
            className="buddy-photo"
            referrerPolicy="no-referrer"
            decoding="async"
            draggable={false}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="buddy-photo-fallback" aria-hidden="true">
            <span>{person.initial}</span>
          </div>
        )}
        <button
          type="button"
          className={`buddy-bookmark ${saved ? 'saved' : ''}`}
          aria-label={saved ? 'ยกเลิกบันทึกโปรไฟล์' : 'บันทึกโปรไฟล์'}
          aria-pressed={saved}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSave()
          }}
        >
          <IconBookmark size={18} filled={saved} />
        </button>
        <div className="buddy-hero-foot">
          <div className="buddy-name-row">
            <Link href={`/u/${person.id}`} className="buddy-name">
              {person.name}
            </Link>
            {person.verified && (
              <span className="buddy-verified" title="Mahidol verified">
                <IconCheck size={13} strokeWidth={3} />
              </span>
            )}
          </div>
          <span className="buddy-role-line">{person.role_line}</span>
        </div>
      </div>

      <div className="buddy-body">
        <div className="buddy-match">
          <span className="ic">
            <IconSparkle size={17} />
          </span>
          <span>{person.match_line}</span>
        </div>

        <p className="buddy-bio">{person.bio}</p>

        {person.works.length > 0 ? (
          <div className="buddy-works">
            <span className="buddy-works-head">ผลงานที่ผ่านมา</span>
            {person.works.map((w, i) => (
              <div key={i} className="buddy-work">
                <span className={`buddy-work-ic ${w.kind}`}>
                  {w.kind === 'award' ? <IconTrophy size={18} /> : <IconLayers size={18} />}
                </span>
                <span className="buddy-work-txt">
                  <b>{w.title}</b>
                  {w.subtitle && <span>{w.subtitle}</span>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          person.skills.length > 0 && (
            <div className="buddy-works">
              <span className="buddy-works-head">ทักษะและความถนัด</span>
              <div className="row wrap" style={{ gap: 6 }}>
                {person.skills.slice(0, 4).map((s) => (
                  <span key={s} className="tag-outline">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )
        )}

        <div className="buddy-actions">
          <Link href={`/u/${person.id}`} className="btn btn-primary btn-pill buddy-btn-main">
            ดูโปรไฟล์
          </Link>
          {person.is_mine ? (
            <Link href="/me" className="btn btn-outline btn-pill buddy-btn-chat">
              แก้ไขโปรไฟล์
            </Link>
          ) : (
            <Link href={`/inbox?to=${person.id}`} className="btn btn-outline btn-pill buddy-btn-chat">
              <IconUserPlus size={18} />
              แชท
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
