import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PostPage from '@/components/PostPage'
import ContactButton from '@/components/ContactButton'
import { getViewer } from '@/lib/auth'
import { getCofounderPost } from '@/lib/data/community'
import { STAGES, TRACKS, TRACK_SEEK_LABEL } from '@/lib/constants'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'หา Co-Founder' }

export default async function CofounderPostPage({ params }: PageProps<'/cofounder/[id]'>) {
  const { id } = await params
  const viewer = await getViewer()
  const post = await getCofounderPost(id, viewer?.userId ?? null)
  if (!post) notFound()
  const { card: c, extra } = post
  const details = [c.problem && `ปัญหาที่ต้องการแก้ไข\n${c.problem}`, extra?.details].filter(Boolean).join('\n\n') || null
  return (
    <PostPage
      kind="cofounder"
      title={c.idea_title || 'หา Co-Founder'}
      lead={c.about}
      author={c.author}
      backHref="/teams?tab=cofounder"
      closed={c.status === 'closed'}
      postedAt={c.created_at}
      loggedIn={Boolean(viewer)}
      details={details}
      detailsHeading="เกี่ยวกับโปรเจกต์"
      contact={extra?.contact ?? null}
      facts={[
        { label: 'ต้องการ Co-Founder ด้าน', value: c.seeking.length ? c.seeking.map((t) => TRACK_SEEK_LABEL[t]).join(' / ') : '—' },
        { label: 'ความเชี่ยวชาญของผู้ลงประกาศ', value: c.my_skills.length ? c.my_skills.map((t) => TRACKS[t]).join(', ') : '—' },
        { label: 'ความคืบหน้า', value: STAGES[c.stage] },
        { label: 'เวลาที่ทุ่มเทได้', value: c.commitment || '—' },
        ...(c.portfolio_url ? [{ label: 'ผลงาน', value: <a href={c.portfolio_url} target="_blank" rel="noopener">{c.portfolio_url.replace(/^https?:\/\//, '')}</a> }] : []),
      ]}
      action={
        c.is_mine ? (
          <Link href="/cofounder/new" className="btn btn-outline btn-pill btn-block">
            แก้ไขประกาศ
          </Link>
        ) : (
          <ContactButton
            targetType="cofounder"
            targetId={c.id}
            kind={c.author.anonymous ? 'intro' : 'message'}
            label={c.author.anonymous ? 'ขอทำความรู้จัก' : 'ส่งข้อความ'}
            targetName={c.author.anonymous ? `ไม่ระบุชื่อ (${c.author.faculty_line})` : c.author.name}
            loggedIn={Boolean(viewer)}
            className="btn-block"
          />
        )
      }
    />
  )
}
