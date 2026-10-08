'use client'
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'
import { deleteEvent, resendEventMatches, saveEvent, unpublishEvent } from '@/app/actions/admin'
import Switch from '../Switch'
import ChipSelect from '../ChipSelect'
import { IconExternal, IconEye, IconLink, IconPin } from '../icons'
import { CATEGORIES, CATEGORY_KEYS, ROLES, ROLE_KEYS, HOME_FEATURED_LIMIT } from '@/lib/constants'
import { hostOf, msLeft, thaiDeadline, timeLeftLabel } from '@/lib/format'
import type { EventRow } from '@/lib/types'

export default function EventEditor({ e, editor, saved }: { e?: EventRow; editor?: string | null; saved?: string | null }) {
  const [state, action, pending] = useActionState(saveEvent, null)
  const [f, setF] = useState({
    title: e?.title ?? '',
    category: e?.category ?? 'competition',
    deadline: e?.deadline ?? '',
    deadline_time: e?.deadline_at
      ? new Date(new Date(e.deadline_at).getTime() + 7 * 3_600_000).toISOString().slice(11, 16)
      : '23:59',
    event_start: e?.event_start ?? '',
    event_end: e?.event_end ?? '',
    location: e?.location ?? '',
    format: e?.format ?? '',
    open_note: e?.open_note ?? '',
    organizer: e?.organizer ?? '',
    summary: e?.summary ?? '',
    benefit: e?.benefit ?? '',
    eligibility: e?.eligibility ?? '',
    overview: e?.overview ?? '',
    apply_url: e?.apply_url ?? '',
  })
  const [flags, setFlags] = useState({
    is_club: e?.is_club ?? false,
    allow_teams: e?.allow_teams ?? true,
    featured: e?.featured ?? false,
    notify_on_publish: e?.notify_on_publish ?? true,
  })
  const [poster, setPoster] = useState<string | null>(e?.poster_url ?? null)
  const [previewTab, setPreviewTab] = useState<'card' | 'detail'>('detail')
  const set = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((cur) => ({ ...cur, [k]: ev.target.value }))
  const overviewLen = f.overview.length
  const paragraphs = useMemo(() => f.overview.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean), [f.overview])
  const previewDeadline = f.deadline ? `${f.deadline}T${f.deadline_time || '23:59'}:00+07:00` : null
  const left = previewDeadline ? msLeft(previewDeadline) : null
  const published = e?.status === 'published'
  const lenTag =
    overviewLen < 300
      ? { bg: '#FFF6D6', c: '#6B4E00', dot: '#E0A800', t: `สั้นไป · ${overviewLen} ตัวอักษร` }
      : overviewLen > 900
        ? { bg: '#FFF6D6', c: '#6B4E00', dot: '#E0A800', t: `ยาวไป · ${overviewLen} ตัวอักษร` }
        : { bg: '#E7F8EE', c: '#067647', dot: '#16A34A', t: `เหมาะสม · ${overviewLen} ตัวอักษร` }

  return (
    <form action={action} className="stack" style={{ gap: 22 }}>
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="admin-top">
        <div>
          <Link href="/admin/events" style={{ fontSize: 14, textDecoration: 'none' }}>
            ← งานแข่ง &amp; ทุน
          </Link>
          <h1 style={{ margin: '6px 0 0', fontSize: 28, lineHeight: 1.25 }}>{f.title || 'งานใหม่ (ยังไม่ตั้งชื่อ)'}</h1>
          {e && (
            <span className="row muted" style={{ gap: 8, marginTop: 6, fontSize: 13 }}>
              <span className={`tag tag-sm ${published ? 'tag-ok' : 'tag-yellow'}`}>{published ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}</span>
              {editor && `แก้ไขล่าสุดโดย ${editor}`}
              {e.notified_at && ' · ส่งแจ้งเตือนแล้ว'}
            </span>
          )}
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          {e && (
            <Link href={`/opportunities/${e.slug}`} target="_blank" className="btn btn-ghost btn-sm">
              <IconEye size={18} /> ดูหน้าจริง
            </Link>
          )}
          <button type="submit" name="intent" value="draft" className="btn btn-outline" disabled={pending}>
            {published ? 'บันทึก' : 'บันทึกร่าง'}
          </button>
          <button type="submit" name="intent" value="publish" className="btn btn-orange" style={{ fontWeight: 700, fontSize: 16 }} disabled={pending}>
            {pending ? 'กำลังบันทึก…' : published ? 'อัปเดต' : 'เผยแพร่'}
          </button>
        </div>
      </div>
      {saved && !state?.error && (
        <div className="alert alert-ok">
          {saved === 'published' ? 'เผยแพร่/อัปเดตแล้ว' : 'บันทึกแล้ว'}
          {saved === 'published' && flags.notify_on_publish && !e?.notified_at && ' · กำลังส่งแจ้งเตือนให้คนที่ตรงกับงานนี้'}
        </div>
      )}
      {state?.error && <div className="alert alert-error">{state.error}</div>}

      <div className="row wrap" style={{ gap: 28, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 560px', minWidth: 0 }}>
          <div className="sheet" style={{ borderRadius: 22 }}>
            <section style={{ padding: '24px 28px', gap: 18 }}>
              <div className="step-title">
                <span className="step-num">1</span>
                <h2 style={{ fontSize: 19 }}>ข้อมูลหลัก</h2>
              </div>
              <div className="field">
                <span className="label" style={{ fontSize: 14 }}>
                  โปสเตอร์
                </span>
                <div className="row" style={{ gap: 16, padding: 12, borderRadius: 14, border: '1.5px dashed var(--border-3)', background: '#F8FAFE' }}>
                  {poster ? (
                    <img src={poster} alt="โปสเตอร์ปัจจุบัน" style={{ flex: 'none', width: 72, height: 90, borderRadius: 10, objectFit: 'cover', objectPosition: 'top' }} />
                  ) : (
                    <span style={{ flex: 'none', width: 72, height: 90, borderRadius: 10, background: 'var(--bg-3)' }} />
                  )}
                  <span className="stack" style={{ flex: 1, gap: 6 }}>
                    <span className="muted" style={{ fontSize: 13 }}>
                      ภาพแนวตั้ง 4:5 · ไม่เกิน 2 MB
                    </span>
                    <label className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start', color: 'var(--brand)' }}>
                      {poster ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                      <input
                        type="file"
                        name="poster"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        onChange={(ev) => {
                          const file = ev.target.files?.[0]
                          if (file) setPoster(URL.createObjectURL(file))
                        }}
                      />
                    </label>
                  </span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="t" style={{ fontSize: 14 }}>
                  ชื่องาน
                </label>
                <input id="t" name="title" className="input" value={f.title} onChange={set('title')} maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="sm" style={{ fontSize: 14 }}>
                  คำอธิบายสั้นบนการ์ด <span className="opt">(ไม่บังคับ)</span>
                </label>
                <input id="sm" name="summary" className="input" value={f.summary} onChange={set('summary')} maxLength={120} placeholder="เช่น ทุนพัฒนาไอเดียและต้นแบบสูงสุด 1.5 ล้านบาท" />
                <p className="help" style={{ fontSize: 12 }}>เว้นว่างได้ — การ์ดจะใช้ประโยคแรกของรายละเอียดงานแทน</p>
              </div>
              <div className="grid-2" style={{ gap: 14 }}>
                <div className="field">
                  <label htmlFor="c" style={{ fontSize: 14 }}>
                    ประเภท
                  </label>
                  <select id="c" name="category" className="select" value={f.category} onChange={set('category')}>
                    {CATEGORY_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {CATEGORIES[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="d" style={{ fontSize: 14 }}>
                    วันและเวลาปิดรับ <span className="opt">(เวลาไทย)</span>
                  </label>
                  <div className="row" style={{ gap: 8 }}>
                    <input id="d" name="deadline" type="date" className="input" value={f.deadline} onChange={set('deadline')} style={{ flex: 1 }} />
                    <input aria-label="เวลาปิดรับ" name="deadline_time" type="time" className="input" value={f.deadline_time} onChange={set('deadline_time')} style={{ flex: '0 0 120px' }} />
                  </div>
                  {left !== null && <p className="help" style={{ fontSize: 12 }}>{left > 0 ? `นับถอยหลังบนเว็บ: ${timeLeftLabel(left)}` : 'เวลานี้ผ่านไปแล้ว — งานจะแสดงเป็น “ปิดรับแล้ว”'}</p>}
                </div>
                <div className="field">
                  <label htmlFor="o" style={{ fontSize: 14 }}>
                    ผู้จัด
                  </label>
                  <input id="o" name="organizer" className="input" value={f.organizer} onChange={set('organizer')} maxLength={80} />
                </div>
                <div className="field">
                  <label htmlFor="f" style={{ fontSize: 14 }}>
                    ประโยชน์ที่ได้รับ
                  </label>
                  <input id="f" name="benefit" className="input" value={f.benefit} onChange={set('benefit')} maxLength={80} placeholder="เช่น ทุน 1.5 ล้านบาท + Mentoring" />
                </div>
              </div>
              <div className="grid-2" style={{ gap: 14 }}>
                <div className="field">
                  <label htmlFor="es" style={{ fontSize: 14 }}>
                    วันเริ่มกิจกรรม <span className="opt">(ไม่บังคับ)</span>
                  </label>
                  <input id="es" name="event_start" type="date" className="input" value={f.event_start} onChange={set('event_start')} />
                </div>
                <div className="field">
                  <label htmlFor="ee" style={{ fontSize: 14 }}>
                    วันสิ้นสุดกิจกรรม <span className="opt">(ไม่บังคับ)</span>
                  </label>
                  <input id="ee" name="event_end" type="date" className="input" value={f.event_end} onChange={set('event_end')} />
                </div>
                <div className="field">
                  <label htmlFor="fm" style={{ fontSize: 14 }}>
                    รูปแบบ
                  </label>
                  <select id="fm" name="format" className="select" value={f.format} onChange={set('format')}>
                    <option value="">— ไม่ระบุ —</option>
                    <option value="onsite">ออนไซต์</option>
                    <option value="online">ออนไลน์</option>
                    <option value="hybrid">ออนไลน์ + ออนไซต์</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="lc" style={{ fontSize: 14 }}>
                    สถานที่ <span className="opt">(ไม่บังคับ)</span>
                  </label>
                  <input id="lc" name="location" className="input" value={f.location} onChange={set('location')} maxLength={80} placeholder="เช่น ม.มหิดล ศาลายา / กรุงเทพฯ" />
                </div>
              </div>
              {!f.deadline && (
                <div className="field">
                  <label htmlFor="on" style={{ fontSize: 14 }}>
                    ข้อความแทนวันปิดรับ <span className="opt">(เมื่อไม่มีวันปิดรับ)</span>
                  </label>
                  <input id="on" name="open_note" className="input" value={f.open_note} onChange={set('open_note')} maxLength={60} placeholder="เช่น เปิดรับสมัครแล้ว" />
                </div>
              )}
              {f.deadline && <input type="hidden" name="open_note" value={f.open_note} />}
              <div className="field">
                <label htmlFor="w" style={{ fontSize: 14 }}>
                  ใครสมัครได้
                </label>
                <input id="w" name="eligibility" className="input" maxLength={40} value={f.eligibility} onChange={set('eligibility')} placeholder="เช่น นศ. + บัณฑิตจบใหม่ ≤ 5 ปี" />
                <p className="help" style={{ fontSize: 12 }}>
                  สั้นๆ ให้อยู่ในช่องเดียว · {f.eligibility.length}/40
                </p>
              </div>
              <div className="field">
                <span className="label" style={{ fontSize: 14 }}>
                  เหมาะกับสาย <span className="opt">(ใช้คัดคนที่จะได้รับแจ้งเตือน และให้ AI ค้นเจอ)</span>
                </span>
                <ChipSelect name="tags" label="สายที่เกี่ยวข้อง" options={ROLE_KEYS.map((k) => ({ value: k, label: ROLES[k] }))} defaultValue={e?.tags ?? []} />
              </div>
            </section>

            <section style={{ padding: '24px 28px', gap: 18 }}>
              <div className="step-title">
                <span className="step-num">2</span>
                <h2 style={{ fontSize: 19 }}>ภาพรวมที่ผู้ใช้อ่าน</h2>
              </div>
              <div className="field">
                <label htmlFor="ov" style={{ fontSize: 14 }}>
                  ภาพรวม
                </label>
                <textarea id="ov" name="overview" rows={8} className="textarea" value={f.overview} onChange={set('overview')} />
                <p className="row wrap muted" style={{ margin: '8px 0 0', justifyContent: 'space-between', gap: '8px 12px', fontSize: 12 }}>
                  <span>เว้นบรรทัดว่าง = ขึ้นย่อหน้าใหม่ · แนะนำ 300–600 ตัวอักษร (2–3 ย่อหน้า)</span>
                  <span className="row" style={{ flex: 'none', gap: 6, padding: '3px 10px', borderRadius: 999, background: lenTag.bg, color: lenTag.c, fontWeight: 600 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: lenTag.dot }} />
                    {lenTag.t}
                  </span>
                </p>
              </div>
            </section>

            <section style={{ padding: '24px 28px', gap: 18 }}>
              <div className="step-title">
                <span className="step-num yellow">3</span>
                <h2 style={{ fontSize: 19 }}>การสมัครและการแสดงผล</h2>
              </div>
              <div className="toggle-row yellow" style={{ padding: '14px 16px' }}>
                <span style={{ flex: 'none', width: 36, height: 36, borderRadius: 10, background: 'var(--yellow)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconPin size={18} />
                </span>
                <span className="txt">
                  <b>กิจกรรมโดยตรงจากชมรม</b>
                  <span style={{ color: '#6B4E00' }}>ติ้กแล้วจะปักหมุดไว้บนสุดของหน้า “งานแข่ง &amp; ทุน” และหน้าแรก พร้อมป้าย “จากชมรม”</span>
                </span>
                <Switch checked={flags.is_club} onChange={(v) => setFlags({ ...flags, is_club: v })} label="กิจกรรมโดยตรงจากชมรม" name="is_club" />
              </div>
              <div className="field">
                <label htmlFor="u" style={{ fontSize: 14 }}>
                  ลิงก์สมัคร <span style={{ color: '#D92D20' }}>*</span>
                </label>
                <div className="row" style={{ gap: 8 }}>
                  <span className="row" style={{ flex: 1, minWidth: 0, gap: 8, padding: '0 14px', minHeight: 46, borderRadius: 12, border: '1.5px solid var(--border-3)', background: '#fff' }}>
                    <span className="muted" style={{ display: 'inline-flex' }}>
                      <IconLink size={18} />
                    </span>
                    <input id="u" name="apply_url" type="url" value={f.apply_url} onChange={set('apply_url')} placeholder="https://forms.gle/… หรือลิงก์ฟอร์มของผู้จัด" style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 15, color: 'var(--navy)' }} />
                  </span>
                  {f.apply_url && (
                    <a href={f.apply_url} target="_blank" rel="noopener" className="btn btn-outline btn-sm" style={{ minHeight: 46, color: 'var(--brand)' }}>
                      ทดสอบ <IconExternal size={14} />
                    </a>
                  )}
                </div>
                {hostOf(f.apply_url) && (
                  <p className="row muted" style={{ margin: '8px 0 0', gap: 8, fontSize: 13, alignItems: 'flex-start' }}>
                    <span style={{ flex: 'none', marginTop: 7, width: 8, height: 8, borderRadius: '50%', background: '#16A34A' }} />
                    <span>
                      ผู้ใช้กด “สมัครเลย” บนหน้ารายละเอียด แล้วระบบจะเปิด <b style={{ color: 'var(--navy)', fontWeight: 600 }}>{hostOf(f.apply_url)}</b> ในแท็บใหม่ · ใช้ได้ทั้ง Google Form, Microsoft Forms หรือเว็บของผู้จัด
                    </span>
                  </p>
                )}
              </div>
              {(
                [
                  ['allow_teams', 'เปิดให้ชวนคนเข้าทีมสำหรับงานนี้', 'แสดงกล่อง “ทีมที่กำลังมองหาคน” ในหน้ารายละเอียด'],
                  ['featured', 'แสดงบนหน้าแรก', `ส่วน “เปิดรับสมัครอยู่ตอนนี้” แสดงได้ ${HOME_FEATURED_LIMIT} งาน`],
                  ['notify_on_publish', 'แจ้งเตือนผ่าน LINE เมื่อเผยแพร่', 'ส่งให้คนที่ทักษะหรือความสนใจตรงกับงานนี้ (คนที่ไม่ได้เชื่อม LINE ได้รับทางอีเมล)'],
                ] as const
              ).map(([k, title, desc]) => (
                <div key={k} className="row" style={{ gap: 14 }}>
                  <span className="stack" style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {desc}
                      {k === 'notify_on_publish' && e?.notified_at && ' · งานนี้ส่งแจ้งเตือนไปแล้ว'}
                    </span>
                  </span>
                  <Switch checked={flags[k]} onChange={(v) => setFlags({ ...flags, [k]: v })} label={title} name={k} />
                </div>
              ))}
            </section>
          </div>
        </div>

        <aside className="stack" style={{ flex: '1 1 340px', minWidth: 0, gap: 10 }}>
          <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
            ผู้ใช้จะเห็นแบบนี้
          </span>
          <div role="tablist" aria-label="ตัวอย่าง" className="segmented" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <button type="button" role="tab" aria-selected={previewTab === 'card'} onClick={() => setPreviewTab('card')}>
              การ์ด
            </button>
            <button type="button" role="tab" aria-selected={previewTab === 'detail'} onClick={() => setPreviewTab('detail')}>
              หน้ารายละเอียด
            </button>
          </div>
          {previewTab === 'card' ? (
            <div className="event-card" style={{ pointerEvents: 'none' }}>
              <div className="media">
                {poster ? <img src={poster} alt="" style={{ height: 260 }} /> : <div className="placeholder">ยังไม่มีโปสเตอร์</div>}
              </div>
              <div className="info">
                <span className="cat">{CATEGORIES[f.category as keyof typeof CATEGORIES]}</span>
                <span className="title">{f.title || 'ชื่องาน'}</span>
                <span className="muted" style={{ fontSize: 14 }}>
                  {previewDeadline ? `ปิดรับ ${thaiDeadline(previewDeadline)}${left !== null && left > 0 ? ` · ${timeLeftLabel(left)}` : ''}` : f.open_note || 'เปิดรับสมัครอยู่'}
                </span>
              </div>
            </div>
          ) : (
            <div className="preview-card">
              <div className="stack" style={{ padding: 16, gap: 14 }}>
                {poster ? (
                  <img src={poster} alt="" style={{ display: 'block', width: '100%', height: 220, objectFit: 'cover', objectPosition: 'top', borderRadius: 14 }} />
                ) : (
                  <div style={{ height: 220, borderRadius: 14, background: 'var(--bg-3)' }} />
                )}
                <span className="head" style={{ fontWeight: 600, fontSize: 19, lineHeight: 1.35 }}>
                  {f.title || 'ชื่องาน'}
                  <span style={{ display: 'inline-flex', gap: 6, marginLeft: 8, verticalAlign: 3, fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, lineHeight: 1.6, whiteSpace: 'nowrap' }}>
                    <span style={{ padding: '1px 8px', borderRadius: 999, background: 'var(--bg-2)', color: 'var(--navy-2)' }}>{CATEGORIES[f.category as keyof typeof CATEGORIES]}</span>
                    {left !== null && left > 0 && <span style={{ padding: '1px 8px', borderRadius: 999, background: 'var(--yellow)' }}>{timeLeftLabel(left)}</span>}
                  </span>
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--bg-2)', border: '1px solid var(--bg-2)', borderRadius: 12, overflow: 'hidden', fontSize: 13, lineHeight: 1.4 }}>
                  {[
                    ['ปิดรับ', previewDeadline ? thaiDeadline(previewDeadline) : f.open_note || '—'],
                    ['ประโยชน์ที่ได้รับ', f.benefit || '—'],
                    ['ผู้จัด', f.organizer || '—'],
                    ['ใครสมัครได้', f.eligibility || '—'],
                  ].map(([k, v]) => (
                    <span key={k} style={{ background: '#fff', padding: '9px 11px' }}>
                      <span className="muted" style={{ display: 'block', fontSize: 11 }}>
                        {k}
                      </span>
                      <b style={{ fontWeight: 600 }}>{v}</b>
                    </span>
                  ))}
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  <b className="head" style={{ fontWeight: 500, fontSize: 16 }}>
                    ภาพรวม
                  </b>
                  <div className="stack" style={{ maxHeight: 230, overflowY: 'auto', paddingRight: 6, gap: 8 }}>
                    {paragraphs.length ? (
                      paragraphs.map((p, i) => (
                        <p key={i} style={{ margin: 0, textIndent: '2em', fontSize: 13, lineHeight: 1.75 }}>
                          {p}
                        </p>
                      ))
                    ) : (
                      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                        ยังไม่มีภาพรวม
                      </p>
                    )}
                  </div>
                </div>
                {flags.allow_teams && (
                  <div className="row" style={{ justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(160deg, #E1E9F8 0%, #F4F7FC 100%)', fontSize: 13 }}>
                    <b className="head" style={{ fontWeight: 600, fontSize: 15 }}>
                      ทีมที่กำลังมองหาคน
                    </b>
                    <span className="muted">ผู้ใช้โพสต์เองได้</span>
                  </div>
                )}
              </div>
              <div className="stack" style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border)', gap: 6 }}>
                <span className="btn btn-orange" style={{ pointerEvents: 'none' }}>
                  สมัครเลย <IconExternal size={14} />
                </span>
                <span className="muted" style={{ fontSize: 11, textAlign: 'center' }}>
                  {hostOf(f.apply_url) ? `กดแล้วเปิดฟอร์มสมัครที่ ${hostOf(f.apply_url)} ในแท็บใหม่` : 'ยังไม่ได้ใส่ลิงก์สมัคร'}
                </span>
              </div>
            </div>
          )}
          {e && (
            <div className="box" style={{ gap: 10, marginTop: 10 }}>
              <h2 style={{ fontSize: 16 }}>การจัดการอื่นๆ</h2>
              {published && (
                <button type="submit" formAction={resendEventMatches} formNoValidate className="btn btn-outline btn-sm">
                  ส่งแจ้งเตือนคนที่ตรงกับงานนี้อีกครั้ง
                </button>
              )}
              {published && (
                <button type="submit" formAction={unpublishEvent} formNoValidate className="btn btn-outline btn-sm">
                  ย้ายกลับเป็นฉบับร่าง
                </button>
              )}
              <button
                type="submit"
                formAction={deleteEvent}
                formNoValidate
                className="btn btn-danger btn-sm"
                onClick={(ev) => {
                  if (!confirm('ลบงานนี้ถาวร? ทีมที่ผูกกับงานนี้จะไม่ถูกลบ')) ev.preventDefault()
                }}
              >
                ลบงานนี้
              </button>
            </div>
          )}
        </aside>
      </div>
    </form>
  )
}
