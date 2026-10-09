import Link from 'next/link'
import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import TeamForm from '@/components/forms/TeamForm'
import SeekerForm from '@/components/forms/SeekerForm'
import { IconPeople, IconUser } from '@/components/icons'
import { requireViewer } from '@/lib/auth'
import { openEventOptions } from '@/lib/data/events'

export const metadata: Metadata = { title: 'ลงประกาศหาทีมแข่ง' }

// One entry for competition teams; the first choice decides which form follows:
//   ?as=team   (default) — "มีทีมแล้ว ต้องการสมาชิกเพิ่ม"  → team post
//   ?as=member           — "ยังไม่มีทีม ต้องการเข้าร่วมทีม" → seeker post
export default async function NewTeamPostPage({ searchParams }: PageProps<'/teams/new'>) {
  const sp = await searchParams
  const as = sp.as === 'member' ? 'member' : 'team'
  const event = typeof sp.event === 'string' ? sp.event : undefined
  const viewer = await requireViewer(`/teams/new${as === 'member' ? '?as=member' : ''}`)
  const events = await openEventOptions()
  const href = (a: 'team' | 'member') => `/teams/new?as=${a}${event ? `&event=${event}` : ''}`
  const lineLinked = Boolean(viewer.profile.line_user_id)
  return (
    <div className="bg-soft">
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 96px' }} className="stack">
        <div style={{ marginBottom: 20 }}>
          <Crumbs back="/teams" trail={[{ label: 'หาทีม & Co-Founder', href: '/teams' }, { label: 'ลงประกาศหาทีมแข่ง' }]} />
          <h1 style={{ margin: '4px 0 0', fontWeight: 600, fontSize: 36, lineHeight: 1.2 }}>ลงประกาศหาทีมแข่ง</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 16 }}>เลือกสถานะของคุณ แล้วกรอกรายละเอียดด้านล่าง</p>
        </div>

        <div className="choice-row" role="radiogroup" aria-label="สถานะของคุณ">
          <Link href={href('team')} replace scroll={false} role="radio" aria-checked={as === 'team'} className={`choice ${as === 'team' ? 'on' : ''}`}>
            <span className="ic"><IconPeople size={22} /></span>
            <span className="txt">
              <b>มีทีมแล้ว ต้องการสมาชิกเพิ่ม</b>
              <span>ระบุตำแหน่งที่ทีมยังขาด</span>
            </span>
            <span className="dot" aria-hidden="true" />
          </Link>
          <Link href={href('member')} replace scroll={false} role="radio" aria-checked={as === 'member'} className={`choice ${as === 'member' ? 'on' : ''}`}>
            <span className="ic"><IconUser size={22} /></span>
            <span className="txt">
              <b>ยังไม่มีทีม ต้องการเข้าร่วมทีม</b>
              <span>ระบุทักษะของคุณ ให้ทีมติดต่อมา</span>
            </span>
            <span className="dot" aria-hidden="true" />
          </Link>
        </div>

        {as === 'team' ? (
          <TeamForm events={events} defaultEvent={event} lineLinked={lineLinked} />
        ) : (
          <SeekerForm events={events} defaultEvent={event} defaultSkills={viewer.profile.skills.slice(0, 4)} lineLinked={lineLinked} />
        )}
      </div>
    </div>
  )
}
