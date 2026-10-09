import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PostPage from '@/components/PostPage'
import ContactButton from '@/components/ContactButton'
import { getViewer } from '@/lib/auth'
import { getSeekerPost } from '@/lib/data/community'
import { ROLES, type Role } from '@/lib/constants'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'ประกาศหาทีม' }

export default async function SeekerPostPage({ params }: PageProps<'/teams/looking/[id]'>) {
  const { id } = await params
  const viewer = await getViewer()
  const post = await getSeekerPost(id, viewer?.userId ?? null)
  if (!post) notFound()
  const { card: s, extra } = post
  return (
    <PostPage
      kind="seeker"
      title={s.looking_text}
      author={s.author}
      backHref="/teams?tab=team"
      closed={s.status === 'closed'}
      postedAt={s.created_at}
      loggedIn={Boolean(viewer)}
      details={extra?.details ?? null}
      detailsHeading="เกี่ยวกับผู้สมัคร"
      contact={extra?.contact ?? null}
      facts={[
        { label: 'รายการแข่งขันที่สนใจ', value: s.event ? <Link href={`/opportunities/${s.event.slug}`}>{s.event.title}</Link> : 'เปิดรับทุกรายการ' },
        { label: 'ทักษะ', value: s.skills.length ? s.skills.map((k) => ROLES[k as Role] ?? k).join(', ') : '—' },
      ]}
      action={
        s.is_mine ? (
          <Link href={`/teams/looking/${s.id}/edit`} className="btn btn-outline btn-pill btn-block">
            แก้ไขประกาศ
          </Link>
        ) : (
          <ContactButton
            targetType="seeker"
            targetId={s.id}
            kind={s.author.anonymous ? 'intro' : 'message'}
            label={s.author.anonymous ? 'ขอทำความรู้จัก' : 'ส่งข้อความ'}
            targetName={s.author.anonymous ? `ไม่ระบุชื่อ (${s.author.faculty_line})` : s.author.name}
            loggedIn={Boolean(viewer)}
            className="btn-block"
          />
        )
      }
    />
  )
}
