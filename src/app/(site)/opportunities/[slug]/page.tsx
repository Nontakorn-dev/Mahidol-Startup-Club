import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import { ClubTag, EmptyState, TeamCardView } from '@/components/Cards'
import { ApplyButton, SaveButton, ShareButton } from '@/components/EventActions'
import { IconBuilding, IconCalendar, IconHome, IconMoney, IconUser } from '@/components/icons'
import { getViewer } from '@/lib/auth'
import { getEventBySlug, isSaved } from '@/lib/data/events'
import { listTeams } from '@/lib/data/community'
import { adminClient } from '@/lib/supabase/admin'
import DeadlineBadge from '@/components/DeadlineBadge'
import { closesAt, isClosed, thaiDate, thaiDeadline } from '@/lib/format'
import { googleCalendarUrl } from '@/lib/calendar'
import { CATEGORIES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps<'/opportunities/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const e = await getEventBySlug(decodeURIComponent(slug))
  if (!e) return { title: 'ไม่พบงาน' }
  return {
    title: e.title,
    description: e.summary || e.overview?.slice(0, 160) || undefined,
    openGraph: e.poster_url ? { images: [e.poster_url] } : undefined,
  }
}

function Fact({ icon, k, v, strong = true }: { icon: React.ReactNode; k: string; v: string; strong?: boolean }) {
  return (
    <div>
      <span className="fact-ic">{icon}</span>
      <span className="fact-txt">
        <span className="k">{k}</span>
        <span className="v" style={{ fontWeight: strong ? 600 : 500 }}>
          {v}
        </span>
      </span>
    </div>
  )
}

export default async function EventDetailPage({ params }: PageProps<'/opportunities/[slug]'>) {
  const { slug } = await params
  const viewer = await getViewer()
  const isAdmin = viewer?.profile.role === 'admin'
  const e = await getEventBySlug(decodeURIComponent(slug), isAdmin)
  if (!e) notFound()

  const closed = isClosed(e)
  const closeIso = closesAt(e)?.toISOString() ?? null
  const period =
    e.event_start && e.event_end && e.event_end !== e.event_start
      ? `${thaiDate(e.event_start)} – ${thaiDate(e.event_end)}`
      : e.event_start
        ? thaiDate(e.event_start)
        : null
  const where = [e.format === 'online' ? 'ออนไลน์' : e.format === 'hybrid' ? 'ออนไลน์ + ออนไซต์' : e.format === 'onsite' ? 'ออนไซต์' : null, e.location]
    .filter(Boolean)
    .join(' · ')
  const [saved, teams] = await Promise.all([
    isSaved(viewer?.userId, e.id),
    e.allow_teams ? listTeams(viewer?.userId ?? null, { eventId: e.id, limit: 12 }) : Promise.resolve([]),
  ])
  after(async () => {
    await adminClient().from('event_metrics').insert({ event_id: e.id, kind: 'view', user_id: viewer?.userId ?? null })
  })
  const paragraphs = (e.overview || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const loggedIn = Boolean(viewer)

  return (
    <div className="detail-bg" style={{ lineHeight: 1.75 }}>
      <div className="container" style={{ paddingTop: 24, paddingBottom: 96 }}>
        <div className="stack" style={{ gap: 28 }}>
          <Crumbs back="/opportunities" trail={[{ label: 'งานแข่ง & ทุน', href: '/opportunities' }, { label: e.title }]} />
          {e.status === 'draft' && (
            <div className="alert alert-info">
              ฉบับร่าง — ผู้ใช้ทั่วไปยังไม่เห็นหน้านี้ · <Link href={`/admin/events/${e.id}`}>แก้ไขในหน้าแอดมิน</Link>
            </div>
          )}
          <div className="detail-grid">
            <div className="stack" style={{ minWidth: 0, gap: 18 }}>
              {e.poster_url ? (
                <Image
                  src={e.poster_url}
                  alt={`โปสเตอร์ ${e.title}`}
                  width={900}
                  height={1125}
                  priority
                  className={`detail-poster ${closed ? 'closed' : ''}`}
                />
              ) : (
                <div className="detail-poster" style={{ aspectRatio: '4/5', background: 'var(--bg-4)' }} />
              )}
              <div className="row apply-row" style={{ gap: 10 }}>
                <ApplyButton eventId={e.id} url={e.apply_url} closed={closed} />
                <SaveButton eventId={e.id} initial={saved} loggedIn={loggedIn} />
                <ShareButton title={e.title} />
              </div>
            </div>

            <div className="stack" style={{ minWidth: 0, gap: 22 }}>
              <div className="stack" style={{ gap: 12 }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  {e.is_club && <ClubTag />}
                  <span className="tag tag-white">{CATEGORIES[e.category]}</span>
                  {closed ? (
                    <span className="tag tag-closed">ปิดรับแล้ว</span>
                  ) : (
                    e.deadline && <DeadlineBadge closesAt={closeIso} />
                  )}
                </div>
                <h1 className="detail-title" style={{ margin: 0, fontWeight: 600, fontSize: 46, lineHeight: 1.15 }}>
                  {e.title}
                </h1>
              </div>
              <div className="facts-grid">
                <Fact icon={<IconCalendar size={20} />} k="ปิดรับสมัคร" v={e.deadline ? thaiDeadline(e) : e.open_note || 'เปิดรับอยู่'} />
                <Fact icon={<IconMoney size={20} />} k="ประโยชน์ที่ได้รับ" v={e.benefit || '—'} />
                <Fact icon={<IconBuilding size={20} />} k="ผู้จัด" v={e.organizer || '—'} strong={false} />
                <Fact icon={<IconUser size={20} />} k="ใครสมัครได้" v={e.eligibility || '—'} strong={false} />
                {(period || where) && <Fact icon={<IconCalendar size={20} />} k="วันจัดกิจกรรม" v={period || 'ดูรายละเอียด'} strong={false} />}
                {(period || where) && <Fact icon={<IconHome size={20} />} k="รูปแบบ / สถานที่" v={where || '—'} strong={false} />}
              </div>
              {e.deadline && !closed && (
                <div className="row wrap" style={{ gap: 8 }}>
                  <a href={googleCalendarUrl(e)} target="_blank" rel="noopener" className="btn btn-outline btn-sm">
                    <IconCalendar size={16} /> เพิ่มวันปิดรับลง Google Calendar
                  </a>
                </div>
              )}
              {paragraphs.length > 0 && (
                <section className="prose-card">
                  <h2>รายละเอียด</h2>
                  <div className="prose-scroll" tabIndex={0} aria-label="รายละเอียด (เลื่อนอ่านได้)">
                    {paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>

          {e.allow_teams && (
            <section id="teams" className="teams-band">
              <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
                <div>
                  <div className="row" style={{ gap: 10 }}>
                    <h2 style={{ margin: 0, fontWeight: 600, fontSize: 28, lineHeight: 1.2 }}>ทีมที่กำลังมองหาคน</h2>
                    <span className="tag" style={{ background: 'var(--brand)', color: '#fff', fontSize: 14 }}>
                      {teams.length} ทีม
                    </span>
                  </div>
                  <p className="muted" style={{ margin: '6px 0 0', fontSize: 15 }}>
                    กดสนใจร่วมทีมได้เลย หรือชวนคนเข้าทีมของคุณเองสำหรับงานนี้
                  </p>
                </div>
                <span className="row" style={{ gap: 10 }}>
                  <Link href={`/teams?tab=teams&event=${e.id}`} className="btn btn-ghost">
                    ดูทั้งหมด →
                  </Link>
                  <Link href={`/teams/new?event=${e.id}`} className="btn btn-outline">
                    + ชวนคนเข้าทีม
                  </Link>
                </span>
              </div>
              {teams.length ? (
                <div className="grid-3">
                  {teams.map((t) => (
                    <TeamCardView key={t.id} t={t} loggedIn={loggedIn} showEvent={false} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="ยังไม่มีทีมประกาศหาคนสำหรับงานนี้"
                  body="เริ่มเป็นทีมแรก แล้วให้คนที่สกิลตรงทักมาหาคุณ"
                  action={
                    <Link href={`/teams/looking/new?event=${e.id}`} className="btn btn-outline btn-pill">
                      หรือประกาศว่าคุณกำลังหาทีมสำหรับงานนี้
                    </Link>
                  }
                />
              )}
            </section>
          )}
        </div>
      </div>
      <div className="sticky-apply">
        <ApplyButton eventId={e.id} url={e.apply_url} closed={closed} style={{ minHeight: 52 }} />
        <SaveButton eventId={e.id} initial={saved} loggedIn={loggedIn} compact />
        <ShareButton title={e.title} />
      </div>
    </div>
  )
}
