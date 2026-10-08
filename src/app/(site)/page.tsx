import type { CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import SearchBox from '@/components/SearchBox'
import ConnectMap from '@/components/ConnectMap'
import { EmptyState, EventCardH, SeekerCardView } from '@/components/Cards'
import { IconArrowRight, IconLock, IconPeople, IconTrophy, IconUserPlus } from '@/components/icons'
import { getViewer } from '@/lib/auth'
import { homeFeaturedEvents } from '@/lib/data/events'
import { listSeekers } from '@/lib/data/community'

export const dynamic = 'force-dynamic'

const PARTNERS = [
  { src: '/assets/partners/msc.png', alt: 'Mahidol Startup Club', h: 46, w: 147 },
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
  const [{ events, openCount }, seekers] = await Promise.all([
    homeFeaturedEvents(),
    listSeekers(viewer?.userId ?? null, { limit: 4 }),
  ])

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
              ชมรมสตาร์ตอัพมหาวิทยาลัยมหิดล สำหรับคนที่อยากลงมือทำจริง มีคนซัพพอร์ต และได้เจอเพื่อนร่วมทาง
            </p>
            <div className="hero-search">
              <SearchBox variant="hero" />
            </div>
            <nav aria-label="Explore" className="explore">
              <Link href="/opportunities">
                <span className="ic">
                  <IconTrophy size={18} />
                </span>
                งานแข่ง &amp; ทุน
              </Link>
              <Link href="/teams">
                <span className="ic">
                  <IconPeople size={18} />
                </span>
                เพื่อนร่วมทีม
              </Link>
              <Link href="/cofounder">
                <span className="ic">
                  <IconUserPlus size={18} />
                </span>
                Co-founder
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

      <section style={{ background: 'linear-gradient(180deg, #F4F7FC 0%, #E1E9F8 100%)' }}>
        <div className="container section">
          <div className="head-row">
            <h2 className="section-title">เปิดรับสมัครอยู่ตอนนี้</h2>
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

      <section style={{ background: 'linear-gradient(180deg, #E1E9F8 0%, #F4F7FC 45%, #FFFFFF 100%)' }}>
        <div className="container section" style={{ paddingTop: 72, paddingBottom: 96 }}>
          <div className="stack" style={{ gap: 12, marginBottom: 28 }}>
            <h2 className="section-title">เพื่อนที่กำลังมองหาทีม</h2>
            <div className="seekers-bar">
              <span className="privacy-pill">
                <span style={{ display: 'inline-flex', color: 'var(--navy-2)' }}>
                  <IconLock size={14} />
                </span>
                เลือกไม่เปิดเผยตัวตนได้
              </span>
              <Link href="/teams" className="cta-link">
                ดูทั้งหมด
                <span className="arrow" aria-hidden="true">
                  <IconArrowRight size={18} />
                </span>
              </Link>
            </div>
          </div>
          {seekers.length ? (
            <div className="grid-cards">
              {seekers.map((s) => (
                <SeekerCardView key={s.id} s={s} loggedIn={Boolean(viewer)} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="ยังไม่มีใครประกาศหาทีม"
              body="เป็นคนแรกที่บอกว่ากำลังมองหาทีม แล้วให้ทีมที่ใช่ทักมาหาคุณ"
              action={
                <Link href="/teams/looking/new" className="btn btn-primary btn-pill">
                  ประกาศว่ากำลังหาทีม
                </Link>
              }
            />
          )}
        </div>
      </section>
    </>
  )
}
