import { notFound } from 'next/navigation'
import Crumbs from '@/components/Crumbs'
import DeletePostButton from '@/components/DeletePostButton'
import TeamForm from '@/components/forms/TeamForm'
import { requireViewer } from '@/lib/auth'
import { openEventOptions } from '@/lib/data/events'
import { adminClient } from '@/lib/supabase/admin'

export default async function EditTeamPage({ params }: PageProps<'/teams/[id]/edit'>) {
  const { id } = await params
  const viewer = await requireViewer(`/teams/${id}/edit`)
  const { data: team } = await adminClient().from('team_posts').select('*').eq('id', id).maybeSingle()
  if (!team || team.owner_id !== viewer.userId) notFound()
  const events = await openEventOptions()
  if (team.event_id && !events.some((e) => e.id === team.event_id)) {
    const { data: ev } = await adminClient().from('events').select('id, title, slug').eq('id', team.event_id).maybeSingle()
    if (ev) events.unshift(ev)
  }
  return (
    <div className="bg-soft">
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px var(--gutter) 96px' }} className="stack">
        <div style={{ marginBottom: 24 }}>
          <Crumbs back="/me" trail={[{ label: 'ประกาศของฉัน', href: '/me' }, { label: team.name }]} />
          <h1 style={{ margin: '4px 0 0', fontWeight: 600, fontSize: 36, lineHeight: 1.2 }}>แก้ไขประกาศทีม</h1>
        </div>
        <TeamForm team={team} events={events} lineLinked={Boolean(viewer.profile.line_user_id)} />
        <DeletePostButton type="team" id={team.id} />
      </div>
    </div>
  )
}
