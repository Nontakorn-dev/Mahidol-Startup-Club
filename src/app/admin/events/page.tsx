import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ClubTag } from '@/components/Cards'
import FeaturedStar from '@/components/admin/FeaturedStar'
import { IconEdit, IconEye, IconImage, IconPlus, IconSearch, IconStar } from '@/components/icons'
import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { sortEvents } from '@/lib/data/events'
import { isClosed, thaiDate } from '@/lib/format'
import { CATEGORIES, HOME_FEATURED_LIMIT } from '@/lib/constants'
import type { EventRow } from '@/lib/types'

export const metadata: Metadata = { title: 'งานแข่ง & ทุน' }
export const dynamic = 'force-dynamic'

const COLS = '2.6fr 1.1fr 1.1fr 0.9fr 0.8fr 0.6fr 1fr'

export default async function AdminEventsPage({ searchParams }: PageProps<'/admin/events'>) {
  await requireAdmin()
  const sp = await searchParams
  const status = typeof sp.status === 'string' ? sp.status : 'all'
  const q = typeof sp.q === 'string' ? sp.q.trim().toLowerCase() : ''
  const db = adminClient()
  const [{ data }, { data: teamCounts }] = await Promise.all([
    db.from('events').select('*'),
    db.from('team_posts').select('event_id').eq('status', 'open').not('event_id', 'is', null),
  ])
  const all = sortEvents((data || []) as EventRow[])
  const state = (e: EventRow) => (e.status === 'draft' ? 'draft' : isClosed(e) ? 'closed' : 'open')
  const tabs = [
    { key: 'all', label: 'ทั้งหมด', n: all.length },
    { key: 'open', label: 'เปิดรับ', n: all.filter((e) => state(e) === 'open').length },
    { key: 'draft', label: 'ฉบับร่าง', n: all.filter((e) => state(e) === 'draft').length },
    { key: 'closed', label: 'ปิดรับแล้ว', n: all.filter((e) => state(e) === 'closed').length },
  ]
  const rows = all
    .filter((e) => status === 'all' || state(e) === status)
    .filter((e) => !q || `${e.title} ${e.organizer ?? ''}`.toLowerCase().includes(q))
  const featuredCount = all.filter((e) => e.featured && state(e) === 'open').length
  const teamsBy = new Map<string, number>()
  for (const t of teamCounts || []) teamsBy.set(t.event_id, (teamsBy.get(t.event_id) || 0) + 1)

  return (
    <>
      <div className="admin-top">
        <div>
          <h1>งานแข่ง &amp; ทุน</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 15 }}>
            ทุกงานที่เพิ่มที่นี่จะแสดงในหน้า “งานแข่ง &amp; ทุน” และเลือกขึ้นหน้าแรกได้
          </p>
        </div>
        <Link href="/admin/events/new" className="btn btn-primary" style={{ minHeight: 48 }}>
          <IconPlus size={18} /> เพิ่มงานใหม่
        </Link>
      </div>

      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
        <div role="tablist" aria-label="สถานะ" className="segmented" style={{ flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <Link key={t.key} href={`/admin/events?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`} role="tab" aria-selected={status === t.key}>
              {t.label} <span className="n">{t.n}</span>
            </Link>
          ))}
        </div>
        <form className="admin-search" role="search">
          <IconSearch size={18} />
          <input type="hidden" name="status" value={status} />
          <label htmlFor="aq" className="sr-only">
            ค้นหางาน
          </label>
          <input id="aq" name="q" defaultValue={q} placeholder="ค้นหาชื่องาน หรือผู้จัด" />
        </form>
      </div>

      <div className="row" style={{ gap: 10, padding: '12px 16px', borderRadius: 14, background: 'var(--yellow-soft)', fontSize: 14, color: '#4A3600' }}>
        <span style={{ display: 'inline-flex', color: '#E0A800' }}>
          <IconStar size={18} filled />
        </span>
        หน้าแรกแสดง “เปิดรับสมัครตอนนี้” ได้ {HOME_FEATURED_LIMIT} งาน — เลือกแล้ว {featuredCount}/{HOME_FEATURED_LIMIT} กดดาวเพื่อเปลี่ยน
        {featuredCount < HOME_FEATURED_LIMIT && ' (ช่องที่ว่างจะเติมด้วยงานที่ใกล้ปิดรับที่สุด)'}
      </div>

      <div className="table">
        <div style={{ minWidth: 980 }}>
          <div className="tr th" style={{ gridTemplateColumns: COLS }}>
            <span>งาน</span>
            <span>ประเภท</span>
            <span>ปิดรับ</span>
            <span>สถานะ</span>
            <span>ทีมที่มองหาคน</span>
            <span>หน้าแรก</span>
            <span style={{ textAlign: 'right' }}>จัดการ</span>
          </div>
          {rows.length === 0 && (
            <p className="muted" style={{ padding: 24, margin: 0 }}>
              ไม่พบงาน
            </p>
          )}
          {rows.map((e) => {
            const s = state(e)
            return (
              <div key={e.id} className="tr" style={{ gridTemplateColumns: COLS }}>
                <span className="row" style={{ gap: 14, minWidth: 0 }}>
                  {e.poster_url ? (
                    <Image src={e.poster_url} alt="" width={48} height={60} style={{ flex: 'none', width: 48, height: 60, borderRadius: 8, objectFit: 'cover', objectPosition: 'top' }} />
                  ) : (
                    <span style={{ flex: 'none', width: 48, height: 60, borderRadius: 8, border: '1.5px dashed var(--border-3)', color: 'var(--muted-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconImage size={20} />
                    </span>
                  )}
                  <span className="stack" style={{ minWidth: 0, gap: 2 }}>
                    {e.is_club && (
                      <span style={{ alignSelf: 'flex-start' }}>
                        <ClubTag small />
                      </span>
                    )}
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{e.title}</span>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {e.organizer || '—'}
                    </span>
                  </span>
                </span>
                <span>{CATEGORIES[e.category]}</span>
                <span>{e.deadline ? thaiDate(e.deadline) : e.open_note || '—'}</span>
                <span>
                  <span className={`tag tag-sm ${s === 'open' ? 'tag-ok' : s === 'draft' ? 'tag-yellow' : 'tag-grey'}`} style={{ fontSize: 13 }}>
                    {s === 'open' ? 'เปิดรับ' : s === 'draft' ? 'ฉบับร่าง' : 'ปิดรับแล้ว'}
                  </span>
                </span>
                <span>{teamsBy.get(e.id) || 0} ทีม</span>
                <span>{s === 'open' && <FeaturedStar id={e.id} initial={e.featured} />}</span>
                <span className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                  <Link href={`/admin/events/${e.id}`} aria-label="แก้ไข" title="แก้ไข" className="sq-btn">
                    <IconEdit size={18} />
                  </Link>
                  <Link href={`/opportunities/${e.slug}`} aria-label="ดูหน้าที่ผู้ใช้เห็น" title="ดูหน้าที่ผู้ใช้เห็น" className="sq-btn" target="_blank">
                    <IconEye size={18} />
                  </Link>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
