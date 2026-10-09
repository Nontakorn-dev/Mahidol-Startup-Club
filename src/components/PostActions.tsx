import Link from 'next/link'
import { IconArrowRight, IconPeople, IconUser, IconUserPlus } from './icons'

/** The three kinds of post, as big plain choices (home page and /teams). */
export default function PostActions({ heading, eventId }: { heading?: string; eventId?: string }) {
  const ev = eventId ? `?event=${eventId}` : ''
  return (
    <div className="post-actions">
      {heading && <p className="post-actions-head">{heading}</p>}
      <Link href={`/teams/new${ev}`} className="post-action">
        <span className="ic team">
          <IconPeople size={20} />
        </span>
        <span className="txt">
          <b>มีทีมแล้ว ขาดคน</b>
          <span>บอกว่าอยากได้คนแบบไหน</span>
        </span>
        <IconArrowRight size={18} />
      </Link>
      <Link href={`/teams/looking/new${ev}`} className="post-action">
        <span className="ic seeker">
          <IconUser size={20} />
        </span>
        <span className="txt">
          <b>อยากเข้าทีม</b>
          <span>บอกว่าถนัดอะไร แล้วรอทีมทัก</span>
        </span>
        <IconArrowRight size={18} />
      </Link>
      <Link href="/cofounder/new" className="post-action">
        <span className="ic cofounder">
          <IconUserPlus size={20} />
        </span>
        <span className="txt">
          <b>หาคนมาก่อตั้งด้วยกัน</b>
          <span>มีไอเดียสตาร์ตอัพ อยากได้ co-founder</span>
        </span>
        <IconArrowRight size={18} />
      </Link>
    </div>
  )
}
