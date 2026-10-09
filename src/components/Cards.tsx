import Link from 'next/link'
import Image from 'next/image'
import Avatar from './Avatar'
import ContactButton from './ContactButton'
import { IconCalendar, IconHome, IconLock, IconPin, IconVerified } from './icons'
import { CATEGORIES, ROLES, STAGES, TRACK_SEEK_LABEL, type Role } from '@/lib/constants'
import DeadlineBadge from './DeadlineBadge'
import { closesAt, eventBlurb, isClosed, thaiDeadline } from '@/lib/format'
import type { CofounderCard, EventRow, SeekerCard, TeamCard } from '@/lib/types'

export function ClubTag({ small }: { small?: boolean }) {
  return (
    <span className={`tag tag-club ${small ? 'tag-sm' : ''}`}>
      <IconPin size={13} />
      จากชมรม
    </span>
  )
}

/** Horizontal poster card used on the home page. */
export function EventCardH({ e }: { e: EventRow }) {
  const blurb = eventBlurb(e)
  return (
    <Link href={`/opportunities/${e.slug}`} className="event-h">
      {/* The frame takes the card's height; the image fills it (absolute), so it can never push past the card. */}
      <span className="poster">
        {e.poster_url && <Image src={e.poster_url} alt={`โปสเตอร์ ${e.title}`} width={420} height={524} />}
      </span>
      <div className="body">
        <span className="row wrap tags">
          {e.is_club && <ClubTag />}
          <span className="tag tag-blue">{CATEGORIES[e.category]}</span>
          {e.deadline && <DeadlineBadge closesAt={closesAt(e)?.toISOString() ?? null} size="sm" />}
        </span>
        <span className="title">{e.title}</span>
        {blurb && <span className="summary">{blurb}</span>}
        <span className="facts">
          <span>
            <span style={{ display: 'inline-flex', color: 'var(--gold)' }}>
              <IconCalendar size={16} />
            </span>
            <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{e.deadline ? `ปิดรับ ${thaiDeadline(e)}` : e.open_note || 'เปิดรับสมัครอยู่'}</span>
          </span>
          {e.organizer && (
            <span>
              <IconHome size={16} />
              <span className="org">{e.organizer}</span>
            </span>
          )}
        </span>
        <span className="more">
          <span className="btn btn-primary btn-pill btn-sm">ดูรายละเอียด →</span>
        </span>
      </div>
    </Link>
  )
}

/** Vertical poster card used on the opportunities grid and search results. */
export function EventCard({ e, reason }: { e: EventRow; reason?: string }) {
  const closed = isClosed(e)
  const blurb = eventBlurb(e)
  return (
    <Link href={`/opportunities/${e.slug}`} className={`event-card ${closed ? 'closed' : ''}`}>
      <div className="media">
        {e.poster_url ? (
          <Image src={e.poster_url} alt={`โปสเตอร์ ${e.title}`} width={640} height={560} />
        ) : (
          <div className="placeholder">ยังไม่มีโปสเตอร์</div>
        )}
        {closed ? (
          <span className="badge-pos tag tag-closed">ปิดรับแล้ว</span>
        ) : (
          e.is_club && (
            <span className="badge-pos">
              <ClubTag />
            </span>
          )
        )}
      </div>
      <div className="info">
        <span className="cat">{CATEGORIES[e.category]}</span>
        {/* Phones show the card as a compact row like the home page: these m-* parts replace the ones above/below. */}
        <span className="m-tags row wrap">
          {closed ? <span className="tag tag-closed">ปิดรับแล้ว</span> : e.is_club && <ClubTag />}
          <span className="tag tag-blue">{CATEGORIES[e.category]}</span>
          {!closed && <DeadlineBadge closesAt={closesAt(e)?.toISOString() ?? null} openNote={e.open_note} size="sm" />}
        </span>
        <span className="title">{e.title}</span>
        {blurb && <span className="m-summary">{blurb}</span>}
        <span className="d-only row wrap" style={{ gap: 8, marginTop: 2 }}>
          <DeadlineBadge closesAt={closesAt(e)?.toISOString() ?? null} openNote={e.open_note} size="sm" />
          {e.deadline && !closed && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{thaiDeadline(e)}</span>}
        </span>
        {(e.format || e.location) && (
          <span className="d-only" style={{ fontSize: 13, color: 'var(--muted)' }}>
            {[e.format === 'online' ? 'ออนไลน์' : e.format === 'hybrid' ? 'ออนไลน์ + ออนไซต์' : e.format === 'onsite' ? 'ออนไซต์' : null, e.location].filter(Boolean).join(' · ')}
          </span>
        )}
        <span className="m-facts">
          <span>
            <IconCalendar size={16} />
            <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{e.deadline ? `ปิดรับ ${thaiDeadline(e)}` : e.open_note || 'เปิดรับสมัครอยู่'}</span>
          </span>
          {e.organizer && (
            <span>
              <IconHome size={16} />
              <span className="org">{e.organizer}</span>
            </span>
          )}
        </span>
        {reason && <span className="reason">แนะนำเพราะ {reason}</span>}
      </div>
    </Link>
  )
}

/** What kind of post a card is — shown on every team / seeker / co-founder card. */
export const POST_KIND = { team: '🏆 ทีมแข่งเปิดรับสมาชิก', seeker: '🙋 ต้องการเข้าร่วมทีมแข่ง', cofounder: '🚀 หา Co-Founder' } as const
export function PostKind({ kind }: { kind: keyof typeof POST_KIND }) {
  return <span className={`post-kind ${kind}`}>{POST_KIND[kind]}</span>
}

function Who({ author, href }: { author: SeekerCard['author']; href: string | null }) {
  const inner = (
    <>
      <Avatar name={author.name} initial={author.initial} src={author.avatar_url} anonymous={author.anonymous} size={60} fontSize={22} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span className="name">
          {author.name}
          {author.anonymous && (
            <span style={{ display: 'inline-flex', color: 'var(--muted)' }}>
              <IconLock size={14} />
            </span>
          )}
          {author.verified && (
            <span title="Mahidol verified" style={{ display: 'inline-flex', color: 'var(--brand)' }}>
              <IconVerified size={16} />
            </span>
          )}
        </span>
        <span className="sub">{author.faculty_line}</span>
      </span>
    </>
  )
  return href ? (
    <Link href={href} className="who">
      {inner}
    </Link>
  ) : (
    <div className="who">{inner}</div>
  )
}

export function SeekerCardView({ s, loggedIn, reason }: { s: SeekerCard; loggedIn: boolean; reason?: string }) {
  return (
    <article className="person-card">
      <PostKind kind="seeker" />
      <Who author={s.author} href={s.author.id ? `/u/${s.author.id}` : null} />
      <Link href={`/teams/looking/${s.id}`} className="looking-box" style={{ textDecoration: 'none' }}>
        <span className="k">ต้องการเข้าร่วม</span>
        <span className="v">{s.looking_text}</span>
      </Link>
      {s.skills.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {s.skills.slice(0, 4).map((k) => (
            <span key={k} className="tag-outline">
              {ROLES[k as Role] ?? k}
            </span>
          ))}
        </div>
      )}
      {reason && <span className="reason-line">แนะนำเพราะ {reason}</span>}
      <Link href={`/teams/looking/${s.id}`} className="card-more">
        ดูรายละเอียด →
      </Link>
      <div className="cta">
        {s.is_mine ? (
          <Link href={`/teams/looking/${s.id}/edit`} className="btn btn-outline btn-pill btn-block">
            ประกาศของคุณ · แก้ไข
          </Link>
        ) : (
          <ContactButton
            targetType="seeker"
            targetId={s.id}
            kind={s.author.anonymous ? 'intro' : 'message'}
            label={s.author.anonymous ? 'ขอทำความรู้จัก' : 'ส่งข้อความ'}
            variant={s.author.anonymous ? 'outline' : 'primary'}
            targetName={s.author.anonymous ? `ไม่ระบุชื่อ (${s.author.faculty_line})` : s.author.name}
            loggedIn={loggedIn}
            className="btn-block"
          />
        )}
      </div>
    </article>
  )
}

export function CofounderCardView({ c, loggedIn, reason }: { c: CofounderCard; loggedIn: boolean; reason?: string }) {
  const seekLabel = c.seeking.length ? c.seeking.map((t) => TRACK_SEEK_LABEL[t]).join(' / ') : 'Co-founder'
  return (
    <article className="person-card">
      <PostKind kind="cofounder" />
      <div className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Who author={c.author} href={c.author.id ? `/u/${c.author.id}` : null} />
        </div>
        <span className="tag tag-blue tag-sm">{STAGES[c.stage]}</span>
      </div>
      <div className="looking-box">
        <span className="k">ต้องการ Co-Founder ด้าน</span>
        <span className="v">{seekLabel}</span>
      </div>
      {c.idea_title && (
        <span style={{ fontSize: 14 }}>
          <Link href={`/cofounder/${c.id}`} style={{ fontWeight: 600, color: 'var(--navy)' }}>
            {c.idea_title}
          </Link>
          {c.problem && <span className="muted"> — {c.problem.slice(0, 90)}{c.problem.length > 90 ? '…' : ''}</span>}
        </span>
      )}
      {c.skill_tags.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12, marginRight: 2 }}>
            ทักษะ
          </span>
          {c.skill_tags.map((k) => (
            <span key={k} className="tag-outline">
              {k}
            </span>
          ))}
        </div>
      )}
      {reason && <span className="reason-line">แนะนำเพราะ {reason}</span>}
      <Link href={`/cofounder/${c.id}`} className="card-more">
        ดูรายละเอียด →
      </Link>
      <div className="cta">
        {c.is_mine ? (
          <Link href="/cofounder/new" className="btn btn-outline btn-pill btn-block">
            โปรไฟล์ของคุณ · แก้ไข
          </Link>
        ) : (
          <ContactButton
            targetType="cofounder"
            targetId={c.id}
            kind={c.author.anonymous ? 'intro' : 'message'}
            label={c.author.anonymous ? 'ขอทำความรู้จัก' : 'ส่งข้อความ'}
            variant={c.author.anonymous ? 'outline' : 'primary'}
            targetName={c.author.anonymous ? `ไม่ระบุชื่อ (${c.author.faculty_line})` : c.author.name}
            loggedIn={loggedIn}
            className="btn-block"
          />
        )}
      </div>
    </article>
  )
}

export function TeamCardView({ t, loggedIn, reason, showEvent = true }: { t: TeamCard; loggedIn: boolean; reason?: string; showEvent?: boolean }) {
  return (
    <article className="team-card">
      <PostKind kind="team" />
      <div className="top">
        <span className="team-logo">{Array.from(t.name)[0]?.toUpperCase()}</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
          <Link href={`/teams/${t.id}`} className="head" style={{ fontWeight: 500, fontSize: 18, color: 'var(--navy)', textDecoration: 'none' }}>
            {t.name}
          </Link>
          <span className="muted" style={{ fontSize: 13 }}>
            สมาชิก {t.members_count}/{t.target_size} คน{t.author.anonymous ? ' · ไม่ระบุชื่อผู้โพสต์' : ` · โดย ${t.author.name}`}
          </span>
        </span>
        {t.member_initials.length > 0 && (
          <span className="stack-avatars">
            {t.member_initials.map((i, idx) => (
              <span key={idx}>{i}</span>
            ))}
          </span>
        )}
      </div>
      <span style={{ fontSize: 14 }}>{t.pitch}</span>
      {showEvent && (t.event || t.event_note) && (
        <span className="muted" style={{ fontSize: 13 }}>
          รายการแข่งขัน:{' '}
          {t.event ? <Link href={`/opportunities/${t.event.slug}`}>{t.event.title}</Link> : t.event_note}
        </span>
      )}
      {reason && <span className="reason-line">แนะนำเพราะ {reason}</span>}
      <Link href={`/teams/${t.id}`} className="card-more">
        ดูรายละเอียด →
      </Link>
      <div className="foot">
        <span className="row wrap" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            ต้องการ
          </span>
          {t.roles_needed.map((r) => (
            <span key={r} className="tag tag-yellow tag-sm" style={{ fontSize: 13 }}>
              {ROLES[r] ?? r}
            </span>
          ))}
        </span>
        {t.is_mine ? (
          <Link href={`/teams/${t.id}/edit`} className="btn btn-outline btn-pill btn-sm">
            แก้ไขประกาศ
          </Link>
        ) : (
          <ContactButton
            targetType="team"
            targetId={t.id}
            kind="join"
            label="ขอเข้าร่วมทีม"
            targetName={`ทีม ${t.name}`}
            loggedIn={loggedIn}
            className="btn-sm"
          />
        )}
      </div>
    </article>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {body && <p style={{ margin: 0 }}>{body}</p>}
      {action}
    </div>
  )
}
