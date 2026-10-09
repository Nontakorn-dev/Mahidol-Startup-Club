import { notFound } from 'next/navigation'
import Crumbs from '@/components/Crumbs'
import DeletePostButton from '@/components/DeletePostButton'
import SeekerForm from '@/components/forms/SeekerForm'
import { requireViewer } from '@/lib/auth'
import { openEventOptions } from '@/lib/data/events'
import { adminClient } from '@/lib/supabase/admin'

export default async function EditSeekerPage({ params }: PageProps<'/teams/looking/[id]/edit'>) {
  const { id } = await params
  const viewer = await requireViewer(`/teams/looking/${id}/edit`)
  const { data: seeker } = await adminClient().from('seeker_posts').select('*').eq('id', id).maybeSingle()
  if (!seeker || seeker.owner_id !== viewer.userId) notFound()
  const events = await openEventOptions()
  return (
    <div className="bg-soft">
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px var(--gutter) 96px' }} className="stack">
        <div style={{ marginBottom: 24 }}>
          <Crumbs smart back="/me" trail={[{ label: 'ประกาศของฉัน', href: '/me' }, { label: 'ประกาศหาทีม' }]} />
          <h1 style={{ margin: '4px 0 0', fontWeight: 600, fontSize: 36, lineHeight: 1.2 }}>แก้ไขประกาศหาทีม</h1>
        </div>
        <SeekerForm seeker={seeker} events={events} defaultSkills={viewer.profile.skills} lineLinked={Boolean(viewer.profile.line_user_id)} />
        <DeletePostButton type="seeker" id={seeker.id} />
      </div>
    </div>
  )
}
