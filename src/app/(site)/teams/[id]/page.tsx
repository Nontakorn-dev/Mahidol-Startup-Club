import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PostPage from '@/components/PostPage'
import ContactButton from '@/components/ContactButton'
import { getViewer } from '@/lib/auth'
import { getTeamPost } from '@/lib/data/community'
import { ROLES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps<'/teams/[id]'>): Promise<Metadata> {
  const post = await getTeamPost((await params).id, null)
  return { title: post ? `ทีม ${post.card.name}` : 'ไม่พบประกาศ' }
}

export default async function TeamPostPage({ params }: PageProps<'/teams/[id]'>) {
  const { id } = await params
  const viewer = await getViewer()
  const post = await getTeamPost(id, viewer?.userId ?? null)
  if (!post) notFound()
  const { card: t, extra } = post
  const roles = (list: string[]) => (list.length ? list.map((r) => ROLES[r as keyof typeof ROLES] ?? r).join(', ') : '—')
  return (
    <PostPage
      kind="team"
      title={t.name}
      lead={t.pitch}
      author={t.author}
      backHref="/teams?tab=team"
      closed={t.status === 'closed'}
      postedAt={t.created_at}
      loggedIn={Boolean(viewer)}
      details={extra?.details ?? null}
      contact={extra?.contact ?? null}
      facts={[
        { label: 'รายการแข่งขัน', value: t.event ? <Link href={`/opportunities/${t.event.slug}`}>{t.event.title}</Link> : t.event_note || 'ยังไม่ระบุ' },
        { label: 'สมาชิก', value: `${t.members_count} จาก ${t.target_size} คน` },
        { label: 'ตำแหน่งที่ต้องการ', value: roles(t.roles_needed) },
        { label: 'ทักษะที่ทีมมีอยู่แล้ว', value: roles(t.has_skills) },
      ]}
      action={
        t.is_mine ? (
          <Link href={`/teams/${t.id}/edit`} className="btn btn-outline btn-pill btn-block">
            แก้ไขประกาศ
          </Link>
        ) : (
          <ContactButton targetType="team" targetId={t.id} kind="join" label="ขอเข้าร่วมทีม" targetName={`ทีม ${t.name}`} loggedIn={Boolean(viewer)} className="btn-block" />
        )
      }
    />
  )
}
