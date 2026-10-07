import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import SyncButton from '@/components/admin/SyncButton'
import { approveImport, approveSelected, setImportStatus } from '@/app/actions/imports'
import { IconExternal } from '@/components/icons'
import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { adminTime, deadlineLine } from '@/lib/format'
import { CATEGORIES, type Category } from '@/lib/constants'

export const metadata: Metadata = { title: 'นำเข้างาน (Hackza)' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TYPE_LABEL: Record<string, string> = {
  hackathon: 'Hackathon / ประกวด',
  camp_workshop: 'ค่าย / Workshop',
  business_case: 'Business case',
  exchange: 'Exchange',
}
const TABS = [
  { key: 'pending', label: 'รอตรวจ' },
  { key: 'approved', label: 'อนุมัติแล้ว' },
  { key: 'rejected', label: 'ไม่เอา' },
  { key: 'expired', label: 'หมดเวลา' },
] as const

type Mapped = { summary: string | null; benefit: string | null; eligibility: string | null; overview: string | null; apply_url: string | null }

export default async function ImportsPage({ searchParams }: PageProps<'/admin/imports'>) {
  await requireAdmin()
  const sp = await searchParams
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? 'pending') as (typeof TABS)[number]['key']
  const db = adminClient()
  const [{ data: rows }, { data: all }, { data: runs }] = await Promise.all([
    db.from('event_imports').select('*').eq('status', tab).order(tab === 'pending' ? 'deadline' : 'reviewed_at', { ascending: tab === 'pending', nullsFirst: false }).limit(200),
    db.from('event_imports').select('status'),
    db.from('import_runs').select('*').eq('source', 'hackza').order('started_at', { ascending: false }).limit(5),
  ])
  const counts = (all || []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {})
  const last = runs?.[0]

  return (
    <>
      <div className="admin-top">
        <div>
          <h1>นำเข้างานจาก Hackza</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 15 }}>
            ระบบดึงงานสาย startup · นวัตกรรม · workshop · ธุรกิจ จาก{' '}
            <a href="https://www.hackza.org/hackathons" target="_blank" rel="noopener">
              hackza.org
            </a>{' '}
            ทุก 6 ชั่วโมง แล้วรอให้แอดมินตรวจก่อนเผยแพร่
          </p>
        </div>
        <SyncButton />
      </div>

      <div className="row wrap muted" style={{ gap: 10, fontSize: 13 }}>
        {last ? (
          <>
            <span className={`tag tag-sm ${last.error ? 'tag-yellow' : 'tag-ok'}`}>{last.error ? 'ซิงก์ล่าสุดมีปัญหา' : 'ซิงก์ล่าสุดสำเร็จ'}</span>
            <span>
              {adminTime(last.started_at)} ({last.trigger === 'cron' ? 'อัตโนมัติ' : 'กดเอง'}) · ดึงมา {last.fetched} · เกี่ยวข้อง {last.relevant} · ใหม่ {last.inserted} · ข้าม {last.skipped}
            </span>
            {last.error && <span style={{ color: 'var(--danger)' }}>{last.error}</span>}
          </>
        ) : (
          <span>ยังไม่เคยซิงก์ — กด “ซิงก์ตอนนี้” เพื่อดึงครั้งแรก</span>
        )}
      </div>

      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
        <div role="tablist" className="segmented" style={{ flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <Link key={t.key} href={`/admin/imports?tab=${t.key}`} role="tab" aria-selected={tab === t.key}>
              {t.label} <span className="n">{counts[t.key] || 0}</span>
            </Link>
          ))}
        </div>
        {tab === 'pending' && (rows?.length ?? 0) > 0 && (
          <form id="bulk" action={approveSelected} className="row" style={{ gap: 8 }}>
            <span className="muted" style={{ fontSize: 13 }}>ติ๊กเลือกแล้ว</span>
            <button type="submit" className="btn btn-primary btn-sm">
              อนุมัติ &amp; เผยแพร่ที่เลือก
            </button>
          </form>
        )}
      </div>

      {(rows || []).length === 0 && (
        <div className="empty">
          <h3>{tab === 'pending' ? 'ไม่มีงานรอตรวจ' : 'ไม่มีรายการ'}</h3>
          {tab === 'pending' && <p style={{ margin: 0 }}>งานใหม่ที่เกี่ยวข้องจะเข้ามาที่นี่อัตโนมัติทุก 6 ชั่วโมง</p>}
        </div>
      )}

      <div className="stack" style={{ gap: 14 }}>
        {(rows || []).map((r) => {
          const m = r.mapped as Mapped
          return (
            <article key={r.id} className="box" style={{ gap: 12 }}>
              <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
                {tab === 'pending' && (
                  <input type="checkbox" name="ids" value={r.id} form="bulk" aria-label={`เลือก ${r.title}`} style={{ marginTop: 6, width: 18, height: 18 }} />
                )}
                {r.poster_url ? (
                  <Image src={r.poster_url} alt="" width={84} height={105} style={{ flex: 'none', width: 84, height: 105, borderRadius: 10, objectFit: 'cover', objectPosition: 'top' }} />
                ) : (
                  <span style={{ flex: 'none', width: 84, height: 105, borderRadius: 10, background: 'var(--bg-3)' }} />
                )}
                <div className="stack" style={{ flex: 1, minWidth: 0, gap: 6 }}>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <span className="tag tag-sm tag-blue">{TYPE_LABEL[r.source_type] ?? r.source_type}</span>
                    <span className="tag tag-sm tag-grey">→ {CATEGORIES[r.category as Category] ?? r.category}</span>
                    <span className="tag tag-sm" style={{ background: r.relevance >= 8 ? 'var(--ok-soft)' : 'var(--yellow-soft)', color: r.relevance >= 8 ? 'var(--ok)' : 'var(--yellow-ink)' }}>
                      ความเกี่ยวข้อง {r.relevance}
                    </span>
                  </div>
                  <b style={{ fontSize: 16, lineHeight: 1.35 }}>{r.title}</b>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {r.organizer || '—'} · {deadlineLine(r.deadline)}
                  </span>
                  {r.matched?.length > 0 && (
                    <span className="row wrap" style={{ gap: 6, fontSize: 12 }}>
                      <span className="muted">ตรงกับ:</span>
                      {r.matched.map((k: string) => (
                        <span key={k} className="tag-outline" style={{ fontSize: 12, padding: '1px 8px', color: k === 'อาจไม่ตรงสาย' ? 'var(--danger)' : undefined }}>
                          {k}
                        </span>
                      ))}
                    </span>
                  )}
                  <details>
                    <summary style={{ cursor: 'pointer', fontSize: 14, color: 'var(--brand)' }}>ดูรายละเอียดที่จะเผยแพร่</summary>
                    <div className="stack" style={{ gap: 6, marginTop: 8, fontSize: 14 }}>
                      {m.summary && <span><b>คำอธิบายสั้น:</b> {m.summary}</span>}
                      {m.benefit && <span><b>ประโยชน์:</b> {m.benefit}</span>}
                      {m.eligibility && <span><b>ใครสมัครได้:</b> {m.eligibility}</span>}
                      {m.apply_url && (
                        <span>
                          <b>ลิงก์สมัคร:</b>{' '}
                          <a href={m.apply_url} target="_blank" rel="noopener">
                            {m.apply_url}
                          </a>
                        </span>
                      )}
                      {m.overview && <p style={{ margin: 0, whiteSpace: 'pre-line', maxHeight: 260, overflow: 'auto', padding: 12, borderRadius: 12, background: 'var(--bg)' }}>{m.overview}</p>}
                    </div>
                  </details>
                </div>
              </div>
              <div className="row wrap" style={{ gap: 8, justifyContent: 'flex-end' }}>
                {r.source_url && (
                  <a href={r.source_url} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
                    ดูบน Hackza <IconExternal size={14} />
                  </a>
                )}
                {tab === 'pending' && (
                  <>
                    <form action={setImportStatus}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <button type="submit" className="btn btn-danger btn-sm">ไม่เอา</button>
                    </form>
                    <form action={approveImport}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="mode" value="edit" />
                      <button type="submit" className="btn btn-outline btn-sm">แก้ไขก่อนเผยแพร่</button>
                    </form>
                    <form action={approveImport}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="mode" value="publish" />
                      <button type="submit" className="btn btn-orange btn-sm">อนุมัติ &amp; เผยแพร่</button>
                    </form>
                  </>
                )}
                {tab === 'approved' && r.event_id && (
                  <Link href={`/admin/events/${r.event_id}`} className="btn btn-outline btn-sm">
                    เปิดในหน้างาน
                  </Link>
                )}
                {(tab === 'rejected' || tab === 'expired') && (
                  <form action={setImportStatus}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="pending" />
                    <button type="submit" className="btn btn-outline btn-sm">ย้ายกลับไปรอตรวจ</button>
                  </form>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
