import Link from 'next/link'
import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import SearchBox from '@/components/SearchBox'
import { EmptyState, EventCard } from '@/components/Cards'
import { listPublishedEvents } from '@/lib/data/events'
import { CATEGORIES, CATEGORY_KEYS, type Category } from '@/lib/constants'

export const metadata: Metadata = { title: 'งานแข่ง & ทุน' }
export const dynamic = 'force-dynamic'

export default async function OpportunitiesPage({ searchParams }: PageProps<'/opportunities'>) {
  const sp = await searchParams
  const cat = (typeof sp.cat === 'string' && (CATEGORY_KEYS as string[]).includes(sp.cat) ? sp.cat : undefined) as Category | undefined
  const events = await listPublishedEvents({ category: cat })
  const filters: { key?: Category; label: string }[] = [
    { label: 'ทั้งหมด' },
    ...(['grant', 'team_recruit', 'competition', 'incubation', 'workshop'] as Category[]).map((k) => ({ key: k, label: CATEGORIES[k] })),
  ]
  return (
    <div className="bg-soft">
      <section className="page-head">
        <div className="inner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 18 }}>
          <Crumbs back="/" trail={[{ label: 'หน้าแรก', href: '/' }, { label: 'งานแข่ง & ทุน' }]} />
          <h1>งานแข่ง &amp; ทุน</h1>
          <SearchBox id="q2" maxWidth={760} placeholder="อยากทำอะไรต่อ? ลองพิมพ์ดู เช่น หาทีมลง TED Youth" scope="events" />
        </div>
      </section>
      <div className="container" style={{ paddingTop: 32, paddingBottom: 96 }}>
        <div className="stack" style={{ gap: 24 }}>
          <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              {filters.map((f) => (
                <Link
                  key={f.label}
                  href={f.key ? `/opportunities?cat=${f.key}` : '/opportunities'}
                  className={`filter-chip ${cat === f.key ? 'active' : ''}`}
                  scroll={false}
                >
                  {f.label}
                </Link>
              ))}
            </div>
            <span className="muted" style={{ fontSize: 14 }}>
              {events.length} รายการ
            </span>
          </div>
          {events.length ? (
            <div className="grid-events">
              {events.map((e) => (
                <EventCard key={e.id} e={e} />
              ))}
            </div>
          ) : (
            <EmptyState title="ยังไม่มีงานในหมวดนี้" body="ลองดูหมวดอื่น หรือพิมพ์สิ่งที่อยากทำในช่องค้นหาด้านบน" />
          )}
        </div>
      </div>
    </div>
  )
}
