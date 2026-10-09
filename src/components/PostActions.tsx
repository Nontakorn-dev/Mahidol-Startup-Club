import Link from 'next/link'
import { IconArrowRight, IconPeople, IconUser, IconUserPlus } from './icons'

const ACTIONS = [
  { kind: 'team', href: '/teams/new', icon: <IconPeople size={26} />, title: 'มีทีมแข่งแล้ว ขาดคน', body: 'บอกว่าลงงานไหน และอยากได้คนสายไหนมาเติมทีม', cta: 'ลงประกาศหาคน' },
  { kind: 'seeker', href: '/teams/looking/new', icon: <IconUser size={26} />, title: 'อยากเข้าทีมแข่ง', body: 'บอกว่าคุณถนัดอะไร แล้วรอทีมที่ใช่ทักมา', cta: 'ลงประกาศหาทีม' },
  { kind: 'cofounder', href: '/cofounder/new', icon: <IconUserPlus size={26} />, title: 'หา Co-Founder', body: 'มีไอเดียสตาร์ตอัพ อยากได้คนมาร่วมสร้างด้วยกัน', cta: 'ลงประกาศหา Co-Founder' },
] as const

/** The three kinds of post, as big plain choices (home page and /teams). */
export default function PostActions({ heading, eventId }: { heading?: string; eventId?: string }) {
  const ev = eventId ? `?event=${eventId}` : ''
  return (
    <section className="post-actions-wrap">
      {heading && <h3 className="post-actions-head">{heading}</h3>}
      <div className="post-actions">
        {ACTIONS.map((a) => (
          <Link key={a.kind} href={a.kind === 'cofounder' ? a.href : `${a.href}${ev}`} className={`post-action ${a.kind}`}>
            <span className="ic">{a.icon}</span>
            <span className="txt">
              <b>{a.title}</b>
              <span>{a.body}</span>
            </span>
            <span className="go">
              <span className="go-label">{a.cta}</span>
              <IconArrowRight size={18} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
