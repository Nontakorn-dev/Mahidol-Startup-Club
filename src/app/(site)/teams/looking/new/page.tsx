import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import SeekerForm from '@/components/forms/SeekerForm'
import { requireViewer } from '@/lib/auth'
import { openEventOptions } from '@/lib/data/events'

export const metadata: Metadata = { title: 'ประกาศหาทีม' }

export default async function NewSeekerPage({ searchParams }: PageProps<'/teams/looking/new'>) {
  const sp = await searchParams
  const viewer = await requireViewer('/teams/looking/new')
  const events = await openEventOptions()
  return (
    <div className="bg-soft">
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 96px' }} className="stack">
        <div style={{ marginBottom: 24 }}>
          <Crumbs back="/teams" trail={[{ label: 'หาทีม', href: '/teams' }, { label: 'ประกาศหาทีม' }]} />
          <h1 style={{ margin: '4px 0 0', fontWeight: 600, fontSize: 40, lineHeight: 1.2 }}>ประกาศว่ากำลังหาทีม</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 16 }}>
            ทีมที่ขาดคนแบบคุณจะเจอการ์ดของคุณ และทักมาได้ทันที — เลือกไม่เปิดเผยชื่อได้
          </p>
        </div>
        <SeekerForm
          events={events}
          defaultEvent={typeof sp.event === 'string' ? sp.event : undefined}
          defaultSkills={viewer.profile.skills.slice(0, 4)}
          lineLinked={Boolean(viewer.profile.line_user_id)}
        />
      </div>
    </div>
  )
}
