import Link from 'next/link'
import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import SearchBox from '@/components/SearchBox'
import { CofounderCardView, EmptyState } from '@/components/Cards'
import { IconUserPlus } from '@/components/icons'
import { getViewer } from '@/lib/auth'
import { listCofounders } from '@/lib/data/community'
import { TRACK_KEYS, type Track } from '@/lib/constants'

export const metadata: Metadata = { title: 'Co-founder' }
export const dynamic = 'force-dynamic'

const FILTERS: { key?: Track; label: string }[] = [
  { label: 'ทั้งหมด' },
  { key: 'tech', label: 'มองหา Tech' },
  { key: 'business', label: 'มองหา Business' },
  { key: 'design', label: 'มองหา Design' },
  { key: 'domain_expert', label: 'มองหา Domain expert' },
]

export default async function CofounderPage({ searchParams }: PageProps<'/cofounder'>) {
  const sp = await searchParams
  const seek = typeof sp.seek === 'string' && (TRACK_KEYS as string[]).includes(sp.seek) ? (sp.seek as Track) : undefined
  const viewer = await getViewer()
  const items = await listCofounders(viewer?.userId ?? null, { seeking: seek ? [seek] : undefined })
  const mine = viewer ? items.find((c) => c.is_mine) : undefined

  return (
    <div className="bg-soft">
      <section className="page-head">
        <div className="inner">
          <div className="stack" style={{ flex: '1 1 560px', gap: 18 }}>
            <Crumbs back="/" trail={[{ label: 'หน้าแรก', href: '/' }, { label: 'Co-founder' }]} />
            <div>
              <h1>หาคนร่วมก่อตั้ง</h1>
              <p className="lead">คนที่จริงจังกับการสร้างสตาร์ตอัพ และกำลังมองหาคนมาเติมทีมให้ครบ</p>
            </div>
            <SearchBox id="cq" maxWidth={640} placeholder="เช่น technical co-founder สาย HealthTech" scope="cofounder" />
          </div>
          <Link href="/cofounder/new" className="btn btn-outline" style={{ minHeight: 52, color: 'var(--brand)', boxShadow: '0 6px 18px -10px rgba(0,53,173,0.35)' }}>
            <IconUserPlus size={18} />
            {mine ? 'แก้ไขโปรไฟล์ Co-founder' : 'สร้างโปรไฟล์ Co-founder'}
          </Link>
        </div>
      </section>
      <div className="container" style={{ paddingTop: 32, paddingBottom: 96 }}>
        <div className="stack" style={{ gap: 28 }}>
          <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              {FILTERS.map((f) => (
                <Link key={f.label} href={f.key ? `/cofounder?seek=${f.key}` : '/cofounder'} className={`filter-chip ${seek === f.key ? 'active' : ''}`} scroll={false}>
                  {f.label}
                </Link>
              ))}
            </div>
            <span className="muted" style={{ fontSize: 14 }}>
              {items.length} คนเปิดรับ co-founder
            </span>
          </div>
          {items.length ? (
            <div className="grid-cards">
              {items.map((c) => (
                <CofounderCardView key={c.id} c={c} loggedIn={Boolean(viewer)} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="ยังไม่มีโปรไฟล์ในหมวดนี้"
              body="มีไอเดียและกำลังหาคนร่วมสร้าง? สร้างโปรไฟล์ Co-founder ให้คนที่ใช่เจอคุณ"
              action={
                <Link href="/cofounder/new" className="btn btn-primary btn-pill">
                  สร้างโปรไฟล์ Co-founder
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
