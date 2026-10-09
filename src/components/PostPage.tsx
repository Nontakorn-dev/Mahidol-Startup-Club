import Link from 'next/link'
import type { ReactNode } from 'react'
import Avatar from './Avatar'
import Crumbs from './Crumbs'
import { PostKind, POST_KIND } from './Cards'
import { IconLock, IconVerified } from './icons'
import { thaiDate } from '@/lib/format'
import type { PublicAuthor } from '@/lib/types'

export type Fact = { label: string; value: ReactNode }

/** A team / seeker / co-founder post on its own page: summary, full description, contact. */
export default function PostPage({
  kind,
  title,
  lead,
  author,
  facts,
  details,
  detailsHeading = 'รายละเอียด',
  contact,
  loggedIn,
  postedAt,
  action,
  closed,
  backHref,
}: {
  kind: keyof typeof POST_KIND
  title: string
  lead?: string | null
  author: PublicAuthor
  facts: Fact[]
  details: string | null
  detailsHeading?: string
  contact: string | null
  loggedIn: boolean
  postedAt: string
  action: ReactNode
  closed?: boolean
  backHref: string
}) {
  return (
    <div className="bg-soft">
      <section className="page-head">
        <div className="inner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 16 }}>
          <Crumbs smart back={backHref} trail={[{ label: 'หาทีม & Co-Founder', href: backHref }, { label: title }]} />
          <div className="stack" style={{ gap: 10, maxWidth: 820 }}>
            <PostKind kind={kind} />
            <h1 style={{ margin: 0 }}>{title}</h1>
            {lead && <p className="lead">{lead}</p>}
            {closed && <span className="tag tag-closed" style={{ alignSelf: 'flex-start' }}>ปิดรับแล้ว</span>}
          </div>
        </div>
      </section>

      <div className="container post-page">
        <div className="post-main">
          <section className="panel">
            <h2>{detailsHeading}</h2>
            {details ? <p className="post-details">{details}</p> : <p className="muted" style={{ margin: 0 }}>ผู้ลงประกาศยังไม่ได้เพิ่มรายละเอียด</p>}
          </section>
          {facts.length > 0 && (
            <dl className="post-facts">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <aside className="post-side">
          <section className="panel side">
            <h2>ผู้ลงประกาศ</h2>
            {author.id ? (
              <Link href={`/u/${author.id}`} className="post-author">
                <AuthorRow author={author} />
              </Link>
            ) : (
              <div className="post-author">
                <AuthorRow author={author} />
              </div>
            )}
            <span className="muted" style={{ fontSize: 13 }}>ลงประกาศเมื่อ {thaiDate(postedAt.slice(0, 10))}</span>
            {action}
          </section>
          <section className="panel side">
            <h2>ช่องทางติดต่อ</h2>
            {!contact ? (
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>ผู้ลงประกาศไม่ได้ระบุ — ติดต่อผ่านปุ่มด้านบนได้เลย</p>
            ) : loggedIn ? (
              <p className="post-contact">{contact}</p>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                <Link href={`/login?next=${encodeURIComponent(backHref)}`}>เข้าสู่ระบบ</Link> เพื่อดูช่องทางติดต่อ
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function AuthorRow({ author }: { author: PublicAuthor }) {
  return (
    <>
      <Avatar name={author.name} initial={author.initial} src={author.avatar_url} anonymous={author.anonymous} size={52} fontSize={19} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
        <span className="row" style={{ gap: 6, fontWeight: 600 }}>
          {author.name}
          {author.anonymous && <IconLock size={14} />}
          {author.verified && (
            <span title="Mahidol verified" style={{ display: 'inline-flex', color: 'var(--brand)' }}>
              <IconVerified size={16} />
            </span>
          )}
        </span>
        <span className="muted" style={{ fontSize: 13 }}>{author.faculty_line}</span>
      </span>
    </>
  )
}
