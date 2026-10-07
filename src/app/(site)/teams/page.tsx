import Link from 'next/link'
import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import SearchBox from '@/components/SearchBox'
import { EmptyState, SeekerCardView, TeamCardView } from '@/components/Cards'
import { IconLock, IconPlus } from '@/components/icons'
import { getViewer } from '@/lib/auth'
import { listSeekers, listTeams } from '@/lib/data/community'
import { adminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'เพื่อนร่วมทีม' }
export const dynamic = 'force-dynamic'

export default async function TeamsPage({ searchParams }: PageProps<'/teams'>) {
  const sp = await searchParams
  const tab = sp.tab === 'teams' ? 'teams' : 'people'
  const eventId = typeof sp.event === 'string' ? sp.event : undefined
  const viewer = await getViewer()
  const loggedIn = Boolean(viewer)
  const [seekers, teams, event] = await Promise.all([
    listSeekers(viewer?.userId ?? null, { eventId }),
    listTeams(viewer?.userId ?? null, { eventId }),
    eventId
      ? adminClient().from('events').select('id, title, slug').eq('id', eventId).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ])
  const qs = (t: string) => `/teams?tab=${t}${eventId ? `&event=${eventId}` : ''}`

  return (
    <div className="bg-soft">
      <section className="page-head">
        <div className="inner">
          <div className="stack" style={{ flex: '1 1 560px', gap: 18 }}>
            <Crumbs back="/" trail={[{ label: 'หน้าแรก', href: '/' }, { label: 'เพื่อนร่วมทีม' }]} />
            <div>
              <h1>เจอเพื่อนร่วมทีม</h1>
              <p className="lead">เข้าร่วมทีมที่กำลังมองหาคนแบบคุณ หรือชวนเพื่อนใหม่มาตั้งทีมด้วยกัน</p>
            </div>
            <SearchBox id="tq" maxWidth={640} placeholder="เช่น ทีม HealthTech ที่อยากได้ UX" scope="teams" />
          </div>
          <div className="row wrap" style={{ gap: 10 }}>
            <Link href="/teams/looking/new" className="btn btn-outline" style={{ minHeight: 52, color: 'var(--brand)' }}>
              ประกาศหาทีม
            </Link>
            <Link href={`/teams/new${eventId ? `?event=${eventId}` : ''}`} className="btn btn-outline" style={{ minHeight: 52, color: 'var(--brand)', boxShadow: '0 6px 18px -10px rgba(0,53,173,0.35)' }}>
              <IconPlus size={18} />
              ชวนคนเข้าทีม
            </Link>
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingTop: 32, paddingBottom: 96 }}>
        <div className="stack" style={{ gap: 28 }}>
          <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
            <div role="tablist" aria-label="View" className="segmented">
              <Link href={qs('people')} role="tab" aria-selected={tab === 'people'} scroll={false}>
                คนที่มองหาทีม <span className="n">{seekers.length}</span>
              </Link>
              <Link href={qs('teams')} role="tab" aria-selected={tab === 'teams'} scroll={false}>
                ทีมที่มองหาคน <span className="n">{teams.length}</span>
              </Link>
            </div>
            <span className="muted" style={{ fontSize: 14 }}>
              {event && (
                <>
                  เฉพาะงาน <b style={{ color: 'var(--navy)' }}>{event.title}</b> ·{' '}
                  <Link href={`/teams?tab=${tab}`}>ดูทั้งหมด</Link> ·{' '}
                </>
              )}
              {tab === 'people' ? `${seekers.length} คนกำลังมองหาทีม` : `${teams.length} ทีมกำลังมองหาคน`}
            </span>
          </div>

          {tab === 'people' ? (
            <>
              <p className="row muted" style={{ margin: '-8px 0 0', fontSize: 14 }}>
                <span style={{ display: 'inline-flex', color: 'var(--navy-2)' }}>
                  <IconLock size={14} />
                </span>
                เลือกได้ว่าจะแสดงชื่อหรือไม่ระบุตัวตน — ชื่อจริงจะเปิดเผยเมื่อเจ้าของโปรไฟล์ตอบรับคำขอเท่านั้น
              </p>
              {seekers.length ? (
                <div className="grid-cards">
                  {seekers.map((s) => (
                    <SeekerCardView key={s.id} s={s} loggedIn={loggedIn} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="ยังไม่มีใครประกาศหาทีม"
                  body="บอกให้ทุกคนรู้ว่าคุณถนัดอะไร และอยากลงงานไหน"
                  action={
                    <Link href="/teams/looking/new" className="btn btn-primary btn-pill">
                      ประกาศว่ากำลังหาทีม
                    </Link>
                  }
                />
              )}
            </>
          ) : teams.length ? (
            <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))' }}>
              {teams.map((t) => (
                <TeamCardView key={t.id} t={t} loggedIn={loggedIn} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="ยังไม่มีทีมที่กำลังหาคน"
              body="มีไอเดียแล้วแต่ทีมยังไม่ครบ? ประกาศชวนคนเข้าทีมได้เลย"
              action={
                <Link href="/teams/new" className="btn btn-primary btn-pill">
                  ชวนคนเข้าทีม
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
