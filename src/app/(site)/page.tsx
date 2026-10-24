import type { CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import SearchBox from '@/components/SearchBox'
import PostActions from '@/components/PostActions'
import ConnectMap from '@/components/ConnectMap'
import PeopleShowcase from '@/components/PeopleShowcase'
import { CofounderCardView, EmptyState, EventCardH, SeekerCardView, TeamCardView } from '@/components/Cards'
import { IconArrowRight, IconPeople, IconTrophy, IconUserPlus } from '@/components/icons'
import { getViewer } from '@/lib/auth'
import { isClosed } from '@/lib/format'
import { byTrust } from '@/lib/post-order'
import { homeFeaturedEvents, listPublishedEvents } from '@/lib/data/events'
import { listCofounders, listHomePeople, listSeekers, listTeams } from '@/lib/data/community'

export const dynamic = 'force-dynamic'


const PARTNERS = [
  { src: '/assets/partners/msc-2026.png', alt: 'Mahidol Startup Club', h: 44, w: 146 },
  { src: '/assets/partners/int.png', alt: 'iNT Mahidol', h: 52, w: 105 },
  { src: '/assets/partners/mahidol.png', alt: 'Mahidol University', h: 44, w: 170 },
  { src: '/assets/partners/ted-youth.png', alt: 'Mahidol TED Youth Startup', h: 50, w: 150 },
]

function Marquee() {
  const set = [...PARTNERS, ...PARTNERS]
  return (
    <section aria-label="Partners" className="marquee">
      <div className="mask">
        <div className="track">
          {[0, 1].map((k) => (
            <div key={k} className="set" aria-hidden={k === 1 || undefined}>
              {set.map((p, i) => (
                <Image key={i} src={p.src} alt={k ? '' : p.alt} width={p.w} height={p.h} style={{ '--h': `${p.h}px` } as CSSProperties} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default async function HomePage() {
  const viewer = await getViewer()
  const uid = viewer?.userId ?? null
  const [{ events, openCount }, allEvents, teams, seekers, cofounders] = await Promise.all([
    homeFeaturedEvents(),
    listPublishedEvents(),
    listTeams(uid, { limit: 20 }),
    listSeekers(uid, { limit: 12 }),
    listCofounders(uid, { limit: 12 }),
  ])
  const openEvents = allEvents.filter((e) => !isClosed(e))
  const people = await listHomePeople(uid, { teams, seekers, cofounders, openEvents, limit: 40 })
  const myTeams = teams.filter((t) => t.is_mine).map((t) => ({ id: t.id, name: t.name }))

  // One feed, newest first: teams looking for people, people looking for a team, co-founder posts.
  const loggedIn = Boolean(viewer)
  const feed = [
    ...teams.slice(0, 6).map((t) => ({ kind: 'team' as const, author: t.author, at: t.created_at, node: <TeamCardView t={t} loggedIn={loggedIn} />, key: `t-${t.id}` })),
    ...seekers.slice(0, 6).map((s) => ({ kind: 'seeker' as const, author: s.author, at: s.created_at, node: <SeekerCardView s={s} loggedIn={loggedIn} />, key: `s-${s.id}` })),
    ...cofounders.slice(0, 6).map((c) => ({ kind: 'cofounder' as const, author: c.author, at: c.created_at, node: <CofounderCardView c={c} loggedIn={loggedIn} />, key: `c-${c.id}` })),
  ]
    .sort(byTrust)
    .slice(0, 6)

  return (
    <>
      <section className="hero">
        <div className="inner">
          <div className="hero-copy">
            <ConnectMap />
            <span className="eyebrow">สนับสนุนโดย iNT มหาวิทยาลัยมหิดล</span>
            <h1 className="mantra">
              <span className="line">Hands-on Experience.</span>
              <span className="line accent">Support, Connect.</span>
            </h1>
            <p className="hero-lead">
              คอมมูนิตี้สตาร์ตอัพของเด็กมหิดล พื้นที่สำหรับไปเจอคนที่ใช่ ร่วมทีมที่ใช่ และพาไอเดียไปถึงฝันด้วยกัน
            </p>
            <div className="hero-search">
              <SearchBox variant="hero" />
            </div>
            <nav aria-label="Explore" className="explore">
              <Link href="/people">
                <span className="ic">
                  <IconUserPlus size={18} />
                </span>
                เครือข่าย
              </Link>
              <Link href="/teams">
                <span className="ic">
                  <IconPeople size={18} />
                </span>
                {/* Short label here only; the page itself is "หาทีม & Co-Founder" */}
                หาทีม
              </Link>
              <Link href="/opportunities">
                <span className="ic">
                  <IconTrophy size={18} />
                </span>
                งานแข่ง &amp; ทุน
              </Link>
            </nav>
          </div>
          <div className="art" style={{ flex: '1 1 420px', minWidth: 0, justifyContent: 'center' }}>
            <Image
              src="/assets/hero-connect.png"
              alt="MSC Connect: คุณเชื่อมกับเพื่อนร่วมทีม Mentor Startup Partner และนักลงทุน"
              width={500}
              height={500}
              priority
              style={{ width: '100%', maxWidth: 500, height: 'auto' }}
            />
          </div>
        </div>
      </section>

      <Marquee />

      <section style={{ background: 'linear-gradient(180deg, #F4F7FC 0%, #E8EFFB 55%, #E1E9F8 100%)' }}>
        <PeopleShowcase people={people} loggedIn={loggedIn} myTeams={myTeams} />
      </section>

      <section style={{ background: 'linear-gradient(180deg, #E1E9F8 0%, #EEF3FB 55%, #F4F7FC 100%)' }}>
        <div className="container section home-seekers">
          <div className="head-row posts-head" style={{ marginBottom: 24 }}>
            <div className="stack" style={{ gap: 6 }}>
              <h2 className="section-title">หาทีม &amp; Co-Founder</h2>
              <p className="home-posts-sub">ทีมแข่งที่เปิดรับสมาชิก ผู้ที่ต้องการเข้าร่วมทีม และผู้ที่หา Co-Founder</p>
            </div>
            <Link href="/teams" className="cta-link">
              ดูทั้งหมด
              <span className="arrow" aria-hidden="true">
                <IconArrowRight size={18} />
              </span>
            </Link>
          </div>

          <Link href="/teams" className="cta-link posts-cta-block">
            ดูประกาศทั้งหมด
            <span className="arrow" aria-hidden="true">
              <IconArrowRight size={18} />
            </span>
          </Link>

          {feed.length > 0 && (
            <div className="home-posts">
              {feed.map((f) => (
                <div key={f.key} className="home-post">
                  {f.node}
                </div>
              ))}
            </div>
          )}

          <PostActions heading={feed.length ? 'ลงประกาศ' : 'ยังไม่มีประกาศ — ลงเป็นคนแรกได้เลย'} />
        </div>
      </section>

      <section style={{ background: 'linear-gradient(180deg, #F4F7FC 0%, #E8EFFB 55%, #FFFFFF 100%)' }}>
        <div className="container section home-open">
          <div className="head-row">
            <div className="stack" style={{ gap: 6 }}>
              <h2 className="section-title">งานแข่ง &amp; ทุนที่เปิดรับอยู่</h2>
              <p className="home-posts-sub">เจอคนที่ใช่และทีมที่ใช่แล้ว เลือกเวทีไปลงมือทำจริงด้วยกันได้เลย</p>
            </div>
            <Link href="/opportunities" className="cta-link hide-phone">
              <span>
                ดู<span className="only-tablet">งานที่เปิดรับ</span>ทั้งหมด{openCount ? ` ${openCount} งาน` : ''}
              </span>
              <span className="arrow" aria-hidden="true">
                <IconArrowRight size={18} />
              </span>
            </Link>
          </div>
          {events.length ? (
            <>
              <Link href="/opportunities" className="cta-link cta-block">
                ดูงานที่เปิดรับทั้งหมด{openCount ? ` ${openCount} งาน` : ''}
                <span className="arrow" aria-hidden="true">
                  <IconArrowRight size={18} />
                </span>
              </Link>
              <div className="home-open-grid">
                {events.map((e) => (
                  <EventCardH key={e.id} e={e} />
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="ยังไม่มีงานที่เปิดรับตอนนี้" body="ติดตามประกาศจากชมรมผ่าน LINE ได้เลย" />
          )}
        </div>
      </section>
    </>
  )
}
