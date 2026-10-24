'use client'
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Role } from '@/lib/constants'
import { hiResAvatar } from '@/lib/format'
import type { BuddyCard } from '@/lib/types'
import ContactButton from './ContactButton'
import { EmptyState } from './Cards'
import {
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
}
@media (max-width: 1060px) {
  .buddy-fan-viewport {
    --fan-x1: 175px;
    --fan-x2: 310px;
    --fan-x3: 410px;
  }
}
@media (max-width: 680px) {
  .buddy-fan-viewport {
    --fan-x1: 34px;
    --fan-x2: 62px;
    --fan-x3: 84px;
    padding: 14px 0 34px;
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
    transform 0.56s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.48s cubic-bezier(0.22, 1, 0.36, 1);
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
.buddy-fan-viewport.is-dragging .buddy-fan-slot[data-offset="0"] {
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
@media (max-width: 680px) {
  .buddy-fan-slot[data-offset="-1"] {
    opacity: 0;
    pointer-events: none;
    transform: translate3d(-92%, 8px, 0) scale(0.9);
  }
  .buddy-fan-slot[data-offset="1"] {
    opacity: 0.88;
    transform: translate3d(26px, 0, 0) scale(0.92);
  }
  .buddy-fan-slot[data-offset="-2"],
  .buddy-fan-slot[data-offset="2"] {
    opacity: 0;
    pointer-events: none;
    transform: translate3d(46px, 0, 0) scale(0.84);
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
  height: 276px;
  overflow: hidden;
  background: linear-gradient(180deg, #9EC0F2 0%, #5E87CA 55%, #0F295A 100%);
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
`

export default function PeopleShowcase({
  people,
  loggedIn,
  myTeams,
}: {
  people: BuddyCard[]
  loggedIn: boolean
  myTeams: { id: string; name: string }[]
}) {
  const [role, setRole] = useState<'all' | Role>('all')
  // Unbounded integer index so each virtual slot key (`${role}-${vIdx}`) stays mounted and glides smoothly
  const [idx, setIdx] = useState(0)
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

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
    setDragX(0)
    setIsDragging(false)
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

      <div className="buddy-header">
        <div className="buddy-title-wrap">
          <div className="buddy-top-row">
            <h2 className="section-title" style={{ margin: 0 }}>
              หาเพื่อนร่วมทางที่ใช่
            </h2>
            <Link href="/people" className="buddy-net-btn">
              <span>เครือข่าย</span>
              <IconChevronRight size={18} />
            </Link>
          </div>
          <p className="buddy-sub">เจอคนที่จะช่วยพาไอเดียของคุณไปให้ถึงฝัน</p>
        </div>
      </div>

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
            onTouchStart={(e) => {
              if (count <= 1) return
              const t = e.touches[0]
              if (!t) return
              pointerStartRef.current = { x: t.clientX, y: t.clientY }
              setIsDragging(true)
            }}
            onTouchMove={(e) => {
              if (!pointerStartRef.current) return
              const t = e.touches[0]
              if (!t) return
              const dx = t.clientX - pointerStartRef.current.x
              const dy = t.clientY - pointerStartRef.current.y
              if (Math.abs(dx) > Math.abs(dy)) {
                setDragX(dx)
              }
            }}
            onTouchEnd={() => {
              if (!pointerStartRef.current) return
              const dx = dragX
              pointerStartRef.current = null
              setIsDragging(false)
              setDragX(0)
              if (dx < -40) next()
              else if (dx > 40) prev()
            }}
            onTouchCancel={() => {
              pointerStartRef.current = null
              setIsDragging(false)
              setDragX(0)
            }}
          >
            <div
              key={role}
              className="buddy-fan-stage"
              style={{
                display: 'grid',
                gridTemplateColumns: 'min(388px, calc(100vw - 48px))',
                justifyContent: 'center',
                alignItems: 'stretch',
              }}
            >
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
                      myTeams={myTeams}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {count > 1 && (
            <div className="buddy-controls">
              <button
                type="button"
                className="buddy-arrow prev"
                onClick={prev}
                aria-label="คนก่อนหน้า"
              >
                <IconBack size={20} />
              </button>
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
              <button
                type="button"
                className="buddy-arrow next"
                onClick={next}
                aria-label="คนถัดไป"
              >
                <IconChevronRight size={22} />
              </button>
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
  myTeams,
}: {
  person: BuddyCard
  saved: boolean
  onToggleSave: () => void
  loggedIn: boolean
  myTeams: { id: string; name: string }[]
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
