import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import SearchBox from '@/components/SearchBox'
import DeadlineBadge from '@/components/DeadlineBadge'
import { EmptyState, EventCard } from '@/components/Cards'
import { listPublishedEvents } from '@/lib/data/events'
import { closesAt, isClosed, msLeft, thaiDeadline, todayBangkok } from '@/lib/format'
import { CATEGORIES, CATEGORY_KEYS, type Category } from '@/lib/constants'
import type { EventRow } from '@/lib/types'

export const metadata: Metadata = { title: 'งานแข่ง & ทุน' }
export const dynamic = 'force-dynamic'

const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const TH_DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const DAY = 86_400_000

type View = 'closing' | 'new' | 'calendar'

/** Bangkok calendar date of the closing moment. */
const closingDay = (e: EventRow) => {
  const c = closesAt(e)
  return c ? new Date(c.getTime() + 7 * 3_600_000).toISOString().slice(0, 10) : null
}
const iso = (e: EventRow) => closesAt(e)?.toISOString() ?? null

export default async function OpportunitiesPage({ searchParams }: PageProps<'/opportunities'>) {
  const sp = await searchParams
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)
  const cat = ((CATEGORY_KEYS as string[]).includes(str('cat') ?? '') ? str('cat') : undefined) as Category | undefined
  const view: View = str('view') === 'new' ? 'new' : str('view') === 'calendar' ? 'calendar' : 'closing'
  const within = str('within') === '7' ? 7 : str('within') === '30' ? 30 : null
  const online = str('online') === '1'
  const showClosed = str('closed') === '1'

  const all = await listPublishedEvents({ category: cat })
  const now = Date.now()
  let rows = all.filter((e) => (online ? e.format === 'online' || e.format === 'hybrid' : true))
  if (!showClosed) rows = rows.filter((e) => !isClosed(e, now))
  if (within) rows = rows.filter((e) => {
    const ms = msLeft(e, now)
    return ms !== null && ms > 0 && ms <= within * DAY
  })
  if (view === 'new') rows = [...rows].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))

  const closingSoon = all
    .filter((e) => {
      const ms = msLeft(e, now)
      return ms !== null && ms > 0 && ms <= 7 * DAY
    })
    .sort((a, b) => (msLeft(a, now) ?? 0) - (msLeft(b, now) ?? 0))

  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams()
    const cur: Record<string, string | undefined> = { cat, view: view === 'closing' ? undefined : view, within: within ? String(within) : undefined, online: online ? '1' : undefined, closed: showClosed ? '1' : undefined }
    for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v) q.set(k, v)
    const s = q.toString()
    return s ? `/opportunities?${s}` : '/opportunities'
  }

  // Calendar: group by closing month → day
  const today = todayBangkok()
  const dated = rows.filter((e) => closingDay(e)).sort((a, b) => (closesAt(a)!.getTime() - closesAt(b)!.getTime()))
  const months = new Map<string, Map<string, EventRow[]>>()
  for (const e of dated) {
    const d = closingDay(e)!
    const m = d.slice(0, 7)
    if (!months.has(m)) months.set(m, new Map())
    const days = months.get(m)!
    days.set(d, [...(days.get(d) || []), e])
  }
  const undated = rows.filter((e) => !closingDay(e))

  return (
    <div className="bg-soft">
      <section className="page-head">
        <div className="inner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 18 }}>
          <Crumbs back="/" trail={[{ label: 'หน้าแรก', href: '/' }, { label: 'งานแข่ง & ทุน' }]} />
          <h1>งานแข่ง &amp; ทุน</h1>
          <SearchBox id="q2" maxWidth={760} placeholder="อยากทำอะไรต่อ? ลองพิมพ์ดู เช่น หาทีมลง TED Youth" scope="events" />
        </div>
      </section>
      <div className="container" style={{ paddingTop: 28, paddingBottom: 96 }}>
        <div className="stack" style={{ gap: 22 }}>
          {view === 'closing' && !within && closingSoon.length > 0 && (
            <section className="stack" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontWeight: 600, fontSize: 22 }}>⏰ ใกล้ปิดรับใน 7 วัน</h2>
                <Link href={href({ within: '7' })} className="btn btn-ghost btn-sm">
                  ดูทั้งหมด {closingSoon.length} งาน →
                </Link>
              </div>
              <div className="closing-strip">
                {closingSoon.map((e) => (
                  <Link key={e.id} href={`/opportunities/${e.slug}`} className="closing-item">
                    {e.poster_url ? <Image src={e.poster_url} alt="" width={104} height={128} /> : <span style={{ width: 52, height: 64, borderRadius: 10, background: 'var(--bg-3)', flex: 'none' }} />}
                    <span className="stack" style={{ minWidth: 0, gap: 4 }}>
                      <b style={{ fontSize: 14, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.title}</b>
                      <DeadlineBadge closesAt={iso(e)} size="sm" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="stack" style={{ gap: 12 }}>
            <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
              <div role="tablist" aria-label="มุมมอง" className="segmented">
                <Link href={href({ view: null })} role="tab" aria-selected={view === 'closing'} scroll={false}>
                  ใกล้ปิดรับ
                </Link>
                <Link href={href({ view: 'new' })} role="tab" aria-selected={view === 'new'} scroll={false}>
                  เพิ่มล่าสุด
                </Link>
                <Link href={href({ view: 'calendar' })} role="tab" aria-selected={view === 'calendar'} scroll={false}>
                  ปฏิทินปิดรับ
                </Link>
              </div>
              <span className="muted" style={{ fontSize: 14 }}>
                {rows.length} รายการ
              </span>
            </div>
            {/* No filter rows any more — only the three views. Links from elsewhere (LINE, the
                closing-soon strip, search) may still arrive filtered: show that as one clearable chip. */}
            {(cat || within || online || showClosed) && (
              <div className="row wrap" style={{ gap: 8 }}>
                <Link href={href({ cat: null, within: null, online: null, closed: null })} className="filter-chip active" scroll={false}>
                  {[cat && CATEGORIES[cat], within && `ปิดใน ${within} วัน`, online && 'ร่วมออนไลน์ได้', showClosed && 'รวมงานที่ปิดแล้ว'].filter(Boolean).join(' · ')} ✕
                </Link>
              </div>
            )}
          </div>

          {rows.length === 0 ? (
            <EmptyState title="ไม่มีงานตามตัวกรองนี้" body="ลองเอาตัวกรองออก หรือพิมพ์สิ่งที่อยากทำในช่องค้นหาด้านบน" action={<Link href="/opportunities" className="btn btn-outline btn-pill">ล้างตัวกรอง</Link>} />
          ) : view === 'calendar' ? (
            <div className="stack" style={{ gap: 28 }}>
              {[...months.entries()].map(([m, days]) => (
                <section key={m} className="cal-month">
                  <h2>
                    {TH_MONTHS_FULL[Number(m.slice(5, 7)) - 1]} {Number(m.slice(0, 4)) + 543}
                  </h2>
                  {[...days.entries()].map(([d, evs]) => {
                    const dt = new Date(`${d}T00:00:00Z`)
                    return (
                      <div key={d} className="cal-row">
                        <div className={`cal-day ${d === today ? 'today' : ''}`}>
                          <b>{dt.getUTCDate()}</b>
                          <span>{d === today ? 'วันนี้' : TH_DOW[dt.getUTCDay()]}</span>
                        </div>
                        <div className="cal-events">
                          {evs.map((e) => (
                            <Link key={e.id} href={`/opportunities/${e.slug}`} className={`cal-event ${isClosed(e, now) ? 'closed' : ''}`}>
                              <span className="stack" style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                                <b style={{ fontSize: 15 }}>{e.title}</b>
                                <span className="muted" style={{ fontSize: 13 }}>
                                  {CATEGORIES[e.category]} · ปิดรับ {thaiDeadline(e)}
                                  {e.organizer ? ` · ${e.organizer}` : ''}
                                </span>
                              </span>
                              <DeadlineBadge closesAt={iso(e)} size="sm" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </section>
              ))}
              {undated.length > 0 && (
                <section className="cal-month">
                  <h2>เปิดรับตลอด / ยังไม่ระบุวันปิด</h2>
                  <div className="cal-events">
                    {undated.map((e) => (
                      <Link key={e.id} href={`/opportunities/${e.slug}`} className="cal-event">
                        <b style={{ flex: 1, fontSize: 15 }}>{e.title}</b>
                        <DeadlineBadge closesAt={null} openNote={e.open_note} size="sm" />
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="grid-events">
              {rows.map((e) => (
                <EventCard key={e.id} e={e} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
