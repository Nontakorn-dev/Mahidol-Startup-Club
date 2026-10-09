import Link from 'next/link'
import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import SearchBox from '@/components/SearchBox'
import PostActions from '@/components/PostActions'
import { CofounderCardView, EmptyState, SeekerCardView, TeamCardView } from '@/components/Cards'
import { getViewer } from '@/lib/auth'
import { listCofounders, listSeekers, listTeams } from '@/lib/data/community'
import { adminClient } from '@/lib/supabase/admin'
import { TRACK_KEYS, type Track } from '@/lib/constants'

export const metadata: Metadata = { title: 'หาทีม & Co-Founder' }
export const dynamic = 'force-dynamic'

// One page for every "looking for people" post: teams that still need members, people who want
// to join a team, and people looking for a co-founder. Opens on "ทั้งหมด" so everything open is
// visible at once; the tabs narrow it down. (/cofounder redirects here with tab=cofounder.)

type Tab = 'all' | 'teams' | 'people' | 'cofounder'
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'teams', label: 'ทีมเปิดรับสมาชิก' },
  { key: 'people', label: 'ผู้ต้องการเข้าทีม' },
  { key: 'cofounder', label: 'หา Co-Founder' },
]
const SEEK: { key?: Track; label: string }[] = [
  { label: 'ทุกสาย' },
  { key: 'tech', label: 'สาย Tech' },
  { key: 'business', label: 'สาย Business' },
  { key: 'design', label: 'สาย Design' },
  { key: 'domain_expert', label: 'ผู้เชี่ยวชาญเฉพาะด้าน' },
]

export default async function TeamsPage({ searchParams }: PageProps<'/teams'>) {
  const sp = await searchParams
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : 'all'
  const eventId = typeof sp.event === 'string' ? sp.event : undefined
  const seek = typeof sp.seek === 'string' && (TRACK_KEYS as string[]).includes(sp.seek) ? (sp.seek as Track) : undefined
  const viewer = await getViewer()
  const uid = viewer?.userId ?? null
  const loggedIn = Boolean(viewer)
  const [teams, seekers, cofounders, event] = await Promise.all([
    listTeams(uid, { eventId }),
    listSeekers(uid, { eventId }),
    // Co-founder posts aren't tied to one event.
    eventId ? Promise.resolve([]) : listCofounders(uid, { seeking: seek ? [seek] : undefined }),
    eventId ? adminClient().from('events').select('id, title, slug').eq('id', eventId).maybeSingle().then((r) => r.data) : Promise.resolve(null),
  ])

  const counts: Record<Tab, number> = { all: teams.length + seekers.length + cofounders.length, teams: teams.length, people: seekers.length, cofounder: cofounders.length }
  const qs = (t: Tab) => `/teams${t === 'all' ? '' : `?tab=${t}`}${eventId ? `${t === 'all' ? '?' : '&'}event=${eventId}` : ''}`

  const cards = [
    ...(tab === 'all' || tab === 'teams' ? teams.map((t) => ({ at: t.created_at, key: `t-${t.id}`, node: <TeamCardView t={t} loggedIn={loggedIn} /> })) : []),
    ...(tab === 'all' || tab === 'people' ? seekers.map((s) => ({ at: s.created_at, key: `s-${s.id}`, node: <SeekerCardView s={s} loggedIn={loggedIn} /> })) : []),
    ...(tab === 'all' || tab === 'cofounder' ? cofounders.map((c) => ({ at: c.created_at, key: `c-${c.id}`, node: <CofounderCardView c={c} loggedIn={loggedIn} /> })) : []),
  ].sort((a, b) => b.at.localeCompare(a.at))

  const empty: Record<Tab, { title: string; body: string; href: string; cta: string }> = {
    all: { title: 'ยังไม่มีประกาศ', body: 'ลงประกาศเป็นคนแรก แล้วผู้ที่สนใจจะติดต่อคุณ', href: '/teams/new', cta: 'ลงประกาศหาทีมแข่ง' },
    teams: { title: 'ยังไม่มีทีมที่เปิดรับสมาชิก', body: 'มีทีมแข่งแล้วแต่ยังขาดสมาชิก ลงประกาศได้เลย', href: `/teams/new${eventId ? `?event=${eventId}` : ''}`, cta: 'ลงประกาศรับสมาชิก' },
    people: { title: 'ยังไม่มีผู้ต้องการเข้าทีม', body: 'ระบุทักษะของคุณ แล้วให้ทีมที่ตรงกันติดต่อมา', href: '/teams/new?as=member', cta: 'ลงประกาศหาทีม' },
    cofounder: { title: seek ? 'ยังไม่มีประกาศในด้านนี้' : 'ยังไม่มีประกาศหา Co-Founder', body: 'มีไอเดียสตาร์ตอัพและต้องการผู้ร่วมก่อตั้ง ลงประกาศได้เลย', href: '/cofounder/new', cta: 'ลงประกาศหา Co-Founder' },
  }

  return (
    <div className="bg-soft">
      <section className="page-head">
        <div className="inner">
          <div className="stack" style={{ flex: '1 1 560px', gap: 18 }}>
            <Crumbs back="/" trail={[{ label: 'หน้าแรก', href: '/' }, { label: 'หาทีม & Co-Founder' }]} />
            <div>
              <h1>หาทีม &amp; Co-Founder</h1>
              <p className="lead">รวมทีมแข่งที่เปิดรับสมาชิก ผู้ที่ต้องการเข้าร่วมทีม และผู้ที่หา Co-Founder</p>
            </div>
            <SearchBox id="tq" maxWidth={640} placeholder="เช่น ทีม HealthTech ที่อยากได้ UX" scope="teams" />
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingTop: 28, paddingBottom: 96 }}>
        <div className="stack" style={{ gap: 22 }}>
          <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
            <div role="tablist" aria-label="ประเภทประกาศ" className="segmented">
              {TABS.filter((t) => !(eventId && t.key === 'cofounder')).map((t) => (
                <Link key={t.key} href={qs(t.key)} role="tab" aria-selected={tab === t.key} scroll={false}>
                  {t.label} <span className="n">{counts[t.key]}</span>
                </Link>
              ))}
            </div>
          </div>

          {event && (
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              เฉพาะงาน <b style={{ color: 'var(--navy)' }}>{event.title}</b> · <Link href="/teams">ดูทุกงาน</Link>
            </p>
          )}

          {tab === 'cofounder' && (
            <div className="row wrap" style={{ gap: 8 }}>
              {SEEK.map((f) => (
                <Link key={f.label} href={f.key ? `/teams?tab=cofounder&seek=${f.key}` : '/teams?tab=cofounder'} className={`filter-chip ${seek === f.key ? 'active' : ''}`} scroll={false}>
                  {f.label}
                </Link>
              ))}
            </div>
          )}

          {cards.length ? (
            <div className="post-grid">
              {cards.map((c) => (
                <div key={c.key} className="home-post">
                  {c.node}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={empty[tab].title}
              body={empty[tab].body}
              action={
                <Link href={empty[tab].href} className="btn btn-primary btn-pill">
                  {empty[tab].cta}
                </Link>
              }
            />
          )}

          <PostActions heading="ลงประกาศ" eventId={eventId} />
        </div>
      </div>
    </div>
  )
}
