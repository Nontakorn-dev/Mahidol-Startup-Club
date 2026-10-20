/* eslint-disable @next/next/no-img-element -- posters come from many source hosts */
import Link from 'next/link'
import type { Metadata } from 'next'
import { approveImport, approveSelected, dismissDeadlineChange, setImportStatus } from '@/app/actions/imports'
import { IconExternal } from '@/components/icons'
import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { env, serverEnv } from '@/lib/env'
import { adminTime, deadlineLine, thaiDate, thaiDeadline, todayBangkok } from '@/lib/format'
import { CATEGORIES, type Category } from '@/lib/constants'
import { INGEST_SOURCE, sourceName, type ChatgptMeta } from '@/lib/importers/ingest'
import SubmitButton from '@/components/SubmitButton'

export const metadata: Metadata = { title: 'นำเข้างาน' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TABS = [
  { key: 'pending', label: 'รอตรวจ' },
  { key: 'duplicate', label: 'ซ้ำกับที่มีแล้ว' },
  { key: 'skipped', label: 'ข้ามอัตโนมัติ' },
  { key: 'approved', label: 'อนุมัติแล้ว' },
  { key: 'rejected', label: 'ไม่เอา' },
  { key: 'expired', label: 'หมดเวลา' },
] as const
type Tab = (typeof TABS)[number]['key']

const LEVEL_LABEL: Record<string, string> = { university: 'มหาวิทยาลัย', public: 'บุคคลทั่วไป', high_school: 'ม.ปลาย' }

type Mapped = { summary: string | null; benefit: string | null; eligibility: string | null; overview: string | null; apply_url: string | null; location?: string | null; event_start?: string | null; event_end?: string | null; ai?: { f?: string[] }; chatgpt?: ChatgptMeta }
type Run = { started_at: string; finished_at: string | null; fetched: number; inserted: number; updated: number; duplicates: number; skipped: number; error: string | null }
const AI_FIELD: Record<string, string> = { organizer: 'ผู้จัด', location: 'สถานที่', event_start: 'วันเริ่มงาน', event_end: 'วันจบงาน', deadline_at: 'เวลาปิดรับ', benefit: 'รางวัล', eligibility: 'ผู้สมัครได้', format: 'รูปแบบ' }
type ImportRow = {
  id: string
  source: string
  source_url: string | null
  title: string
  organizer: string | null
  poster_url: string | null
  source_type: string
  category: string
  deadline: string | null
  deadline_at: string | null
  mapped: Mapped
  relevance: number
  matched: string[]
  levels: string[]
  flags: string[]
  status: string
  skip_reason: string | null
  duplicate_of: string | null
  duplicate_event_id: string | null
  event_id: string | null
  first_seen_at: string
  last_seen_at: string
}

const dl = (r: { deadline: string | null; deadline_at: string | null }) => ({ deadline: r.deadline, deadline_at: r.deadline_at })
const sameDay = (a: string | null, b: string | null) => !a || !b || a === b

function Check({ ok, warn, children }: { ok?: boolean; warn?: boolean; children: React.ReactNode }) {
  const color = ok ? 'var(--ok)' : warn ? 'var(--yellow-ink)' : 'var(--danger)'
  return (
    <span className="row" style={{ gap: 6, fontSize: 13, color, alignItems: 'baseline' }}>
      <b style={{ width: 14, flex: 'none' }}>{ok ? '✓' : warn ? '!' : '✕'}</b>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{children}</span>
    </span>
  )
}

export default async function ImportsPage({ searchParams }: PageProps<'/admin/imports'>) {
  await requireAdmin()
  const sp = await searchParams
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? 'pending') as Tab
  const source = typeof sp.source === 'string' && /^[a-z]{2,20}$/.test(sp.source) ? sp.source : null
  const db = adminClient()

  const today = todayBangkok()
  let q = db.from('event_imports').select('*').eq('status', tab)
  if (source) q = q.eq('source', source)
  // Skipped listings that already closed can't be rescued — keep the tab short.
  if (tab === 'skipped') q = q.or(`deadline.is.null,deadline.gte.${today}`)
  q =
    tab === 'pending' || tab === 'duplicate'
      ? q.order('deadline', { ascending: true, nullsFirst: false })
      : tab === 'skipped'
        ? q.order('last_seen_at', { ascending: false })
        : q.order('reviewed_at', { ascending: false, nullsFirst: false })
  const [{ data: rowsData }, { data: all }, { data: runData }] = await Promise.all([
    q.limit(200),
    db.from('event_imports').select('status, source, deadline, flags'),
    db.from('import_runs').select('started_at, finished_at, fetched, inserted, updated, duplicates, skipped, error').eq('source', INGEST_SOURCE).order('started_at', { ascending: false }).limit(1),
  ])
  const rows = (rowsData || []) as ImportRow[]
  const lastRun = (runData?.[0] ?? null) as Run | null
  const apiReady = Boolean(serverEnv().importApiKey)

  const counts: Record<string, number> = {}
  const bySource: Record<string, number> = {}
  const sources = new Set<string>()
  let deadlineChanged = 0
  for (const r of all || []) {
    if (r.status === 'approved' && (r.flags as string[] | null)?.some((f) => f.startsWith('deadline_changed:'))) deadlineChanged++
    if (r.status === 'skipped' && r.deadline && r.deadline < today) continue
    sources.add(r.source)
    if (!source || r.source === source) counts[r.status] = (counts[r.status] || 0) + 1
    if (r.status === tab) bySource[r.source] = (bySource[r.source] || 0) + 1
  }
  // ChatGPT first, then the retired scrapers whose rows are still around.
  const sourceKeys = [INGEST_SOURCE, ...[...sources].filter((s) => s !== INGEST_SOURCE).sort()]

  // Cross-source evidence: the same event found elsewhere (duplicates pointing at these rows),
  // and for the duplicate tab, what each row duplicates.
  const ids = rows.map((r) => r.id)
  const [{ data: dupData }, { data: primaryData }, { data: eventData }] = await Promise.all([
    ids.length ? db.from('event_imports').select('id, source, source_url, title, deadline, deadline_at, duplicate_of').in('duplicate_of', ids) : Promise.resolve({ data: [] }),
    tab === 'duplicate' && rows.some((r) => r.duplicate_of)
      ? db.from('event_imports').select('id, source, title, status, deadline, deadline_at').in('id', rows.map((r) => r.duplicate_of).filter(Boolean) as string[])
      : Promise.resolve({ data: [] }),
    tab === 'duplicate' && rows.some((r) => r.duplicate_event_id)
      ? db.from('events').select('id, title, status, deadline, deadline_at').in('id', rows.map((r) => r.duplicate_event_id).filter(Boolean) as string[])
      : Promise.resolve({ data: [] }),
  ])
  const alsoOn = new Map<string, { id: string; source: string; source_url: string | null; deadline: string | null; deadline_at: string | null }[]>()
  for (const d of dupData || []) alsoOn.set(d.duplicate_of!, [...(alsoOn.get(d.duplicate_of!) || []), d])
  const primaries = new Map((primaryData || []).map((p) => [p.id, p]))
  const dupEvents = new Map((eventData || []).map((e) => [e.id, e]))

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams()
    const cur: Record<string, string | null> = { tab, source, ...patch }
    for (const [k, v] of Object.entries(cur)) if (v && !(k === 'tab' && v === 'pending')) p.set(k, v)
    const s = p.toString()
    return s ? `/admin/imports?${s}` : '/admin/imports'
  }

  return (
    <>
      <div className="admin-top">
        <div>
          <h1>นำเข้างาน</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 15, maxWidth: 720 }}>
            ChatGPT ค้นหางานสาย startup · นวัตกรรม · workshop · ธุรกิจ ระดับมหาวิทยาลัย แล้วส่งเข้ามาทุกวันผ่าน API —{' '}
            <b>รอแอดมินตรวจก่อนเผยแพร่เสมอ</b> · งานที่มีในระบบแล้วจะถูกแยกไปแท็บ “ซ้ำกับที่มีแล้ว” ให้อัตโนมัติ
          </p>
        </div>
      </div>

      <section className="box" style={{ gap: 8, padding: 16 }}>
        <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
          <b style={{ fontSize: 15 }}>รับงานผ่าน API</b>
          <span className={`tag tag-sm ${apiReady ? 'tag-ok' : 'tag-yellow'}`}>{apiReady ? 'พร้อมรับ' : 'ยังไม่ได้ตั้ง IMPORT_API_KEY'}</span>
        </div>
        <span style={{ fontSize: 13.5, overflowWrap: 'anywhere' }}>
          <code>POST {env.siteUrl}/api/imports</code> · Header <code>Authorization: Bearer IMPORT_API_KEY</code> ·{' '}
          <a href="/api/imports/openapi.json" target="_blank" rel="noopener">
            ดูรูปแบบข้อมูล (OpenAPI)
          </a>
        </span>
        <span style={{ fontSize: 13, color: lastRun?.error ? 'var(--danger)' : 'var(--muted)' }}>
          {lastRun
            ? `ส่งเข้ามาล่าสุด ${adminTime(lastRun.started_at)} · ${lastRun.fetched} รายการ → ใหม่ ${lastRun.inserted} · อัปเดต ${lastRun.updated} · ซ้ำ ${lastRun.duplicates} · ข้าม/ไม่ผ่าน ${lastRun.skipped}${lastRun.error ? ` — ผิดพลาด: ${lastRun.error}` : ''}`
            : 'ยังไม่มีการส่งข้อมูลเข้ามา'}
        </span>
      </section>

      {deadlineChanged > 0 && (
        <div className="alert alert-info">
          งานที่เผยแพร่แล้ว {deadlineChanged} งาน มีวันปิดรับใหม่จากข้อมูลล่าสุด —{' '}
          <Link href={href({ tab: 'approved', source: null })}>ตรวจในแท็บ “อนุมัติแล้ว”</Link>
        </div>
      )}

      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
        <div role="tablist" className="segmented" style={{ flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <Link key={t.key} href={href({ tab: t.key })} role="tab" aria-selected={tab === t.key}>
              {t.label} <span className="n">{counts[t.key] || 0}</span>
            </Link>
          ))}
        </div>
        {tab === 'pending' && rows.length > 0 && (
          <form id="bulk" action={approveSelected} className="row" style={{ gap: 8 }}>
            <span className="muted" style={{ fontSize: 13 }}>ติ๊กเลือกแล้ว</span>
            <SubmitButton className="btn btn-primary btn-sm">
              อนุมัติ &amp; เผยแพร่ที่เลือก
            </SubmitButton>
          </form>
        )}
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <Link href={href({ source: null })} className={`filter-chip ${!source ? 'active' : ''}`}>
          ทุกแหล่ง
        </Link>
        {sourceKeys.map((s) => (
          <Link key={s} href={href({ source: s })} className={`filter-chip ${source === s ? 'active' : ''}`}>
            {sourceName(s)} {bySource[s] ? `(${bySource[s]})` : ''}
          </Link>
        ))}
      </div>

      {tab === 'skipped' && (
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          รายการที่ระบบข้ามให้ (ปิดรับแล้ว / รับเฉพาะ ม.ปลาย หรือไม่ตรงสายจากตัวดึงเว็บเดิม) — ถ้าเจอที่ใช่ กด “ย้ายไปรอตรวจ” ได้
        </p>
      )}

      {rows.length === 0 && (
        <div className="empty">
          <h3>{tab === 'pending' ? 'ไม่มีงานรอตรวจ' : 'ไม่มีรายการ'}</h3>
          {tab === 'pending' && <p style={{ margin: 0 }}>งานใหม่ที่เกี่ยวข้องจะเข้ามาที่นี่อัตโนมัติ</p>}
        </div>
      )}

      <div className="stack" style={{ gap: 14 }}>
        {rows.map((r) => {
          const m = r.mapped
          const srcName = r.source === INGEST_SOURCE ? (m.chatgpt?.source_name || r.source_type || sourceName(r.source)) : sourceName(r.source)
          const others = alsoOn.get(r.id) || []
          const mismatch = others.filter((o) => !sameDay(o.deadline, r.deadline))
          const flags = new Set(r.flags || [])
          const internal = [...flags].find((f) => f.startsWith('internal_only'))
          const primary = r.duplicate_of ? primaries.get(r.duplicate_of) : null
          const dupEvent = r.duplicate_event_id ? dupEvents.get(r.duplicate_event_id) : null
          return (
            <article key={r.id} className="box" style={{ gap: 12 }}>
              <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
                {tab === 'pending' && <input type="checkbox" name="ids" value={r.id} form="bulk" aria-label={`เลือก ${r.title}`} style={{ marginTop: 6, width: 18, height: 18 }} />}
                {r.poster_url ? (
                  <img src={r.poster_url} alt="" loading="lazy" width={84} height={105} style={{ flex: 'none', width: 84, height: 105, borderRadius: 10, objectFit: 'cover', objectPosition: 'top', background: 'var(--bg-3)' }} />
                ) : (
                  <span style={{ flex: 'none', width: 84, height: 105, borderRadius: 10, background: 'var(--bg-3)' }} />
                )}
                <div className="stack" style={{ flex: 1, minWidth: 0, gap: 6 }}>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <span className="tag tag-sm tag-blue">{sourceName(r.source)}</span>
                    <span className="tag tag-sm tag-grey">{r.source_type}</span>
                    <span className="tag tag-sm tag-grey">→ {CATEGORIES[r.category as Category] ?? r.category}</span>
                    <span className="tag tag-sm" style={{ background: r.relevance >= 8 ? 'var(--ok-soft)' : 'var(--yellow-soft)', color: r.relevance >= 8 ? 'var(--ok)' : 'var(--yellow-ink)' }}>
                      ความเกี่ยวข้อง {r.relevance === -99 ? '—' : r.relevance}
                    </span>
                    {(r.levels || []).map((l) => (
                      <span key={l} className="tag tag-sm tag-grey">
                        {LEVEL_LABEL[l] ?? l}
                      </span>
                    ))}
                  </div>
                  <b style={{ fontSize: 16, lineHeight: 1.35 }}>{r.title}</b>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {r.organizer || 'ไม่ระบุผู้จัด'} · {r.deadline ? deadlineLine(dl(r)) : 'ไม่ระบุวันปิดรับ'}
                  </span>

                  {tab === 'skipped' && r.skip_reason && (
                    <span style={{ fontSize: 13, color: 'var(--yellow-ink)' }}>ข้ามเพราะ: {r.skip_reason}</span>
                  )}
                  {tab === 'duplicate' && (
                    <span style={{ fontSize: 13 }}>
                      ซ้ำกับ:{' '}
                      {primary ? (
                        <>
                          “{primary.title}” จาก {sourceName(primary.source)} ({primary.status === 'approved' ? 'อนุมัติแล้ว' : primary.status === 'rejected' ? 'เคยกด “ไม่เอา”' : 'รอตรวจ'})
                          {!sameDay(primary.deadline, r.deadline) && <b style={{ color: 'var(--danger)' }}> · วันปิดรับไม่ตรงกัน ({thaiDeadline(dl(primary))} vs {thaiDeadline(dl(r))})</b>}
                        </>
                      ) : dupEvent ? (
                        <>
                          งานในระบบ <Link href={`/admin/events/${dupEvent.id}`}>“{dupEvent.title}”</Link>
                          {!sameDay(dupEvent.deadline, r.deadline) && <b style={{ color: 'var(--danger)' }}> · วันปิดรับไม่ตรงกัน ({thaiDeadline(dl(dupEvent))} vs {thaiDeadline(dl(r))})</b>}
                        </>
                      ) : (
                        'รายการที่ถูกลบไปแล้ว'
                      )}
                    </span>
                  )}

                  {(tab === 'pending' || tab === 'approved') && (
                    <div className="stack" style={{ gap: 3, padding: '8px 12px', borderRadius: 10, background: 'var(--bg)' }}>
                      <Check ok={!flags.has('no_official_link')} warn={flags.has('no_official_link')}>
                        {flags.has('no_official_link') ? 'ไม่มีลิงก์สมัครของผู้จัด — ใช้หน้าประกาศของแหล่งข้อมูลแทน' : `ลิงก์สมัครของผู้จัด (${(() => { try { return new URL(m.apply_url!).hostname } catch { return '—' } })()})`}
                      </Check>
                      <Check ok={!flags.has('no_deadline') && !flags.has('date_only')} warn={flags.has('date_only')}>
                        {flags.has('no_deadline') ? 'ไม่พบวันปิดรับ — ตรวจในประกาศก่อนเผยแพร่' : flags.has('date_only') ? `มีแค่วันที่ปิดรับ (${thaiDeadline(dl(r))}) ระบบถือว่าปิด 23:59 น.` : `ปิดรับ ${thaiDeadline(dl(r))}`}
                      </Check>
                      {others.length > 0 ? (
                        <Check ok={mismatch.length === 0} warn={mismatch.length > 0}>
                          พบในแหล่งอื่นด้วย:{' '}
                          {others.map((o, i) => (
                            <span key={o.id}>
                              {i > 0 && ', '}
                              {o.source_url ? (
                                <a href={o.source_url} target="_blank" rel="noopener">
                                  {sourceName(o.source)}
                                </a>
                              ) : (
                                sourceName(o.source)
                              )}
                              {!sameDay(o.deadline, r.deadline) && <b> (ปิด {thaiDeadline(dl(o))} — ไม่ตรงกัน!)</b>}
                            </span>
                          ))}
                        </Check>
                      ) : (
                        <Check warn>พบแหล่งเดียว</Check>
                      )}
                      {flags.has('needs_verification') && <Check warn>แหล่งนี้เคยลงวันที่คลาดเคลื่อน — เทียบกับประกาศทางการก่อน</Check>}
                      {internal && <Check>อาจรับเฉพาะนิสิต/นักศึกษาของมหาวิทยาลัยผู้จัด{internal.includes(':') ? ` (${internal.split(':')[1]})` : ''}</Check>}
                      {flags.has('no_description') && <Check warn>ไม่มีรายละเอียดงาน — เพิ่มเองตอน “แก้ไขก่อนเผยแพร่”</Check>}
                      {m.ai?.f?.length ? (
                        <Check warn>เติมจากรายละเอียดงานโดย AI (ตรวจแล้วว่ามีในข้อความ): {m.ai.f.map((f) => AI_FIELD[f] ?? f).join(', ')} — ดูให้แน่ใจก่อนเผยแพร่</Check>
                      ) : null}
                      {m.chatgpt && (
                        <>
                          {m.chatgpt.evidence.length > 0 ? (
                            <Check ok>
                              ChatGPT ตรวจกับ:{' '}
                              {m.chatgpt.evidence.map((e, i) => (
                                <span key={e}>
                                  {i > 0 && ', '}
                                  <a href={e} target="_blank" rel="noopener">
                                    {(() => {
                                      try {
                                        return new URL(e).hostname.replace(/^www\./, '')
                                      } catch {
                                        return e
                                      }
                                    })()}
                                  </a>
                                </span>
                              ))}
                            </Check>
                          ) : (
                            <Check warn>ChatGPT ไม่ได้แนบแหล่งที่ใช้ตรวจ — เปิดลิงก์ประกาศเทียบก่อนเผยแพร่</Check>
                          )}
                          {m.chatgpt.confidence !== null && (
                            <Check ok={m.chatgpt.confidence >= 0.8} warn={m.chatgpt.confidence < 0.8}>
                              ความมั่นใจของ ChatGPT {Math.round(m.chatgpt.confidence * 100)}%
                            </Check>
                          )}
                          {m.chatgpt.notes && <Check warn>หมายเหตุจาก ChatGPT: {m.chatgpt.notes}</Check>}
                        </>
                      )}
                      {tab === 'approved' &&
                        [...flags]
                          .filter((f) => f.startsWith('deadline_changed:'))
                          .map((f) => (
                            <span key={f} className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
                              <Check>วันปิดรับใหม่จากข้อมูลล่าสุด: {thaiDate(f.split(':')[1])} — แก้ในหน้างานถ้าถูกต้อง</Check>
                              <form action={dismissDeadlineChange}>
                                <input type="hidden" name="id" value={r.id} />
                                <SubmitButton className="btn btn-ghost btn-sm">รับทราบ</SubmitButton>
                              </form>
                            </span>
                          ))}
                    </div>
                  )}

                  {r.matched?.length > 0 && (
                    <span className="row wrap" style={{ gap: 6, fontSize: 12 }}>
                      <span className="muted">ตรงกับ:</span>
                      {r.matched.map((k: string) => (
                        <span key={k} className="tag-outline" style={{ fontSize: 12, padding: '1px 8px', color: k === 'อาจไม่ตรงสาย' || k === 'ม.ปลายเท่านั้น' ? 'var(--danger)' : undefined }}>
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
                      {m.location && <span><b>สถานที่:</b> {m.location}</span>}
                      {m.apply_url && (
                        <span>
                          <b>ลิงก์สมัคร:</b>{' '}
                          <a href={m.apply_url} target="_blank" rel="noopener" style={{ wordBreak: 'break-all' }}>
                            {m.apply_url}
                          </a>
                        </span>
                      )}
                      {m.overview ? (
                        <p style={{ margin: 0, whiteSpace: 'pre-line', maxHeight: 260, overflow: 'auto', padding: 12, borderRadius: 12, background: 'var(--bg)' }}>{m.overview}</p>
                      ) : (
                        <span className="muted">— ไม่มีรายละเอียด —</span>
                      )}
                    </div>
                  </details>
                </div>
              </div>
              <div className="row wrap" style={{ gap: 8, justifyContent: 'flex-end' }}>
                {r.source_url && (
                  <a href={r.source_url} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
                    ดูบน {srcName} <IconExternal size={14} />
                  </a>
                )}
                {tab === 'pending' && (
                  <>
                    <form action={setImportStatus}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <SubmitButton className="btn btn-danger btn-sm">ไม่เอา</SubmitButton>
                    </form>
                    <form action={approveImport}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="mode" value="edit" />
                      <SubmitButton className="btn btn-outline btn-sm">แก้ไขก่อนเผยแพร่</SubmitButton>
                    </form>
                    <form action={approveImport}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="mode" value="publish" />
                      <SubmitButton className="btn btn-orange btn-sm">อนุมัติ &amp; เผยแพร่</SubmitButton>
                    </form>
                  </>
                )}
                {tab === 'approved' && r.event_id && (
                  <Link href={`/admin/events/${r.event_id}`} className="btn btn-outline btn-sm">
                    เปิดในหน้างาน
                  </Link>
                )}
                {(tab === 'rejected' || tab === 'expired' || tab === 'skipped' || tab === 'duplicate') && (
                  <form action={setImportStatus}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="pending" />
                    <SubmitButton className="btn btn-outline btn-sm">
                      {tab === 'duplicate' ? 'ไม่ใช่งานเดียวกัน — ย้ายไปรอตรวจ' : 'ย้ายไปรอตรวจ'}
                    </SubmitButton>
                  </form>
                )}
                {(tab === 'skipped' || tab === 'duplicate') && (
                  <form action={setImportStatus}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <SubmitButton className="btn btn-ghost btn-sm">ซ่อนถาวร</SubmitButton>
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
