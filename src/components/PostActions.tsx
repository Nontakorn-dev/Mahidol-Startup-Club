import Link from 'next/link'
import { CofounderIllustration, TeamIllustration } from './PostIcons'

const ACTIONS = [
  {
    kind: 'team',
    href: '/teams/new',
    icon: <TeamIllustration />,
    title: 'หาทีมแข่ง',
    body: 'มีทีมแล้วแต่ยังขาดสมาชิก หรือยังไม่มีทีมและต้องการเข้าร่วม',
    cta: 'ลงประกาศหาทีมแข่ง',
  },
  {
    kind: 'cofounder',
    href: '/cofounder/new',
    icon: <CofounderIllustration />,
    title: 'หา Co-Founder',
    body: 'มีไอเดียสตาร์ตอัพ และต้องการผู้ร่วมก่อตั้งที่เสริมทักษะกัน',
    cta: 'ลงประกาศหา Co-Founder',
  },
] as const

/** The two kinds of post (home page and /teams): white cards on a navy panel, so the section reads as "your turn". */
export default function PostActions({ heading, eventId }: { heading?: string; eventId?: string }) {
  return (
    <section className="post-actions-wrap">
      <div className="post-actions-intro">
        {heading && <h2 className="section-title post-actions-head">{heading}</h2>}
        <p>ลงประกาศฟรี ใช้เวลาไม่กี่นาที แล้วให้คนที่ใช่ติดต่อคุณ</p>
      </div>
      <div className="post-actions">
        {ACTIONS.map((a) => (
          <Link key={a.kind} href={a.kind === 'team' && eventId ? `${a.href}?event=${eventId}` : a.href} className={`post-action ${a.kind}`}>
            <span className="ic">{a.icon}</span>
            <span className="txt">
              <b>{a.title}</b>
              <span>{a.body}</span>
            </span>
            <span className="btn btn-primary btn-pill">{a.cta}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
