import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import TeamForm from '@/components/forms/TeamForm'
import { requireViewer } from '@/lib/auth'
import { openEventOptions } from '@/lib/data/events'

export const metadata: Metadata = { title: 'ชวนคนเข้าทีม' }

export default async function NewTeamPage({ searchParams }: PageProps<'/teams/new'>) {
  const sp = await searchParams
  const viewer = await requireViewer('/teams/new')
  const events = await openEventOptions()
  return (
    <div className="bg-soft">
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 96px' }} className="stack">
        <div style={{ marginBottom: 24 }}>
          <Crumbs back="/teams" trail={[{ label: 'เพื่อนร่วมทีม', href: '/teams' }, { label: 'ชวนคนเข้าทีม' }]} />
          <h1 style={{ margin: '4px 0 0', fontWeight: 600, fontSize: 40, lineHeight: 1.2 }}>ชวนคนเข้าทีม</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 16 }}>
            เล่าว่าทีมคุณกำลังทำอะไร และกำลังมองหาใคร — คนที่ใช่จะเจอประกาศนี้จากช่องค้นหาของเขาเอง
          </p>
        </div>
        <TeamForm events={events} defaultEvent={typeof sp.event === 'string' ? sp.event : undefined} lineLinked={Boolean(viewer.profile.line_user_id)} />
      </div>
    </div>
  )
}
