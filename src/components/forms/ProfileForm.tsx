'use client'
import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import AvatarCropper from '../AvatarCropper'
import { saveProfile } from '@/app/actions/profile'
import Avatar from '../Avatar'
import InterestsField from '../InterestsField'
import Switch from '../Switch'
import { IconClose, IconPlus } from '../icons'
import { CAMPUSES, FACULTIES, YEARS } from '@/lib/constants'
import type { Profile } from '@/lib/types'

type Exp = { k: number; title: string; subtitle?: string; description?: string }
type LinkRow = { k: number; label: string; url: string }
let seq = 0
const key = () => ++seq

/** Comparable snapshot of the form (files by name + size) so autosave skips no-op saves. */
const snapshot = (form: HTMLFormElement) =>
  JSON.stringify([...new FormData(form)].map(([k, v]) => [k, typeof v === 'string' ? v : `${v.name}:${v.size}`]))

export default function ProfileForm({ p }: { p: Profile }) {
  const [state, action, pending] = useActionState(saveProfile, null)
  const [links, setLinks] = useState<LinkRow[]>(() => (p.links.length ? p.links : [{ label: 'GitHub', url: '' }]).map((l) => ({ ...l, k: key() })))
  const [exps, setExps] = useState<Exp[]>(() => p.experiences.map((x) => ({ ...x, k: key() })))
  const [preview, setPreview] = useState<string | null>(p.avatar_url)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [isPublic, setIsPublic] = useState(p.profile_public ?? true)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Autosave: typing saves ~1 s after the last keystroke; chips, switches, selects and add/remove
  // save almost at once. Dispatching by hand (not <form action>) keeps React from resetting the
  // fields after each save, so nothing typed during a save is lost.
  const formRef = useRef<HTMLFormElement>(null)
  const saved = useRef('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [dirty, setDirty] = useState(false)
  const save = () => {
    clearTimeout(timer.current)
    const form = formRef.current
    if (!form) return
    const now = snapshot(form)
    if (now === saved.current) return setDirty(false)
    saved.current = now
    setDirty(false)
    const data = new FormData(form)
    startTransition(() => action(data))
  }
  const schedule = (delay: number) => {
    clearTimeout(timer.current)
    setDirty(true)
    timer.current = setTimeout(save, delay)
  }
  useEffect(() => {
    if (formRef.current) saved.current = snapshot(formRef.current)
    return () => clearTimeout(timer.current)
  }, [])
  // Once a new photo is uploaded, empty the file input so later saves don't upload it again.
  useEffect(() => {
    if (!state?.ok || !fileRef.current?.files?.length || !formRef.current) return
    fileRef.current.value = ''
    saved.current = snapshot(formRef.current)
  }, [state])
  // Unsaved edits or a save in flight: ask before leaving the page.
  useEffect(() => {
    if (!dirty && !pending) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, pending])

  return (
    <form
      ref={formRef}
      className="stack"
      style={{ gap: 20 }}
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      onInput={(e) => {
        const el = e.target as HTMLInputElement
        if (el.type === 'file') return // a picked photo saves once it's cropped
        schedule(el.tagName === 'SELECT' ? 300 : 1000)
      }}
      onBlur={() => dirty && schedule(0)}
      onClick={(e) => (e.target as HTMLElement).closest('button[type="button"]') && schedule(400)}
    >
      <div className="sheet">
        <section>
          <div className="step-title">
            <span className="step-num">1</span>
            <h2>ข้อมูลพื้นฐาน</h2>
          </div>
          <div className="row" style={{ gap: 16 }}>
            <Avatar name={p.first_name} src={preview} size={84} brand />
            <div className="stack" style={{ gap: 6 }}>
              <label className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }}>
                เปลี่ยนรูป
                <input
                  ref={fileRef}
                  type="file"
                  name="avatar"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    // Open the cropper; the cropped JPEG replaces the picked file before saving.
                    const f = e.target.files?.[0]
                    if (f && !cropSrc) setCropSrc(URL.createObjectURL(f))
                  }}
                />
              </label>
              {preview && (
                <button type="button" className="btn-ghost" style={{ border: 0, background: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }} onClick={() => { setPreview(null); setRemoveAvatar(true) }}>
                  ลบรูป
                </button>
              )}
              <span className="muted" style={{ fontSize: 12 }}>JPG / PNG / WebP · เลือกแล้วจัดตำแหน่งให้เห็นหน้าได้</span>
              {preview && !removeAvatar && preview.startsWith('blob:') && (
                <span style={{ fontSize: 12, color: 'var(--ok)' }}>✓ จัดรูปแล้ว — กำลังบันทึกรูปนี้</span>
              )}
            </div>
            {removeAvatar && <input type="hidden" name="remove_avatar" value="1" />}
            {cropSrc && (
              <AvatarCropper
                src={cropSrc}
                onCancel={() => {
                  URL.revokeObjectURL(cropSrc)
                  setCropSrc(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
                onDone={(file, url) => {
                  const dt = new DataTransfer()
                  dt.items.add(file)
                  if (fileRef.current) fileRef.current.files = dt.files
                  URL.revokeObjectURL(cropSrc)
                  setCropSrc(null)
                  setPreview(url)
                  setRemoveAvatar(false)
                  schedule(0) // file set by script: no input event
                }}
              />
            )}
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="fn">ชื่อ</label>
              <input id="fn" name="first_name" className="input" required maxLength={40} defaultValue={p.first_name} />
            </div>
            <div className="field">
              <label htmlFor="ln">นามสกุล</label>
              <input id="ln" name="last_name" className="input" maxLength={40} defaultValue={p.last_name} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="fa">คณะ</label>
              <select id="fa" name="faculty" className="select" defaultValue={p.faculty ?? ''}>
                <option value="">—</option>
                {FACULTIES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="yr">ชั้นปี</label>
              <select id="yr" name="year" className="select" defaultValue={p.year ?? ''}>
                <option value="">—</option>
                {YEARS.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="cp">วิทยาเขต</label>
              <select id="cp" name="campus" className="select" defaultValue={p.campus ?? ''}>
                <option value="">—</option>
                {CAMPUSES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="hl">แนะนำตัวในหนึ่งบรรทัด</label>
              <input id="hl" name="headline" className="input" maxLength={100} defaultValue={p.headline ?? ''} placeholder="Full-stack developer · สนใจ HealthTech" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="bio">เกี่ยวกับฉัน</label>
            <textarea id="bio" name="bio" className="textarea" rows={4} maxLength={1200} defaultValue={p.bio ?? ''} placeholder="ชอบสร้างอะไร ถนัดเรื่องไหน อยากลงงานแข่งแบบไหน" />
          </div>
        </section>

        <section>
          <div className="step-title">
            <span className="step-num">2</span>
            <h2>ทักษะ และความสนใจ</h2>
          </div>
          <div className="field">
            <label htmlFor="sk">ทักษะ</label>
            <input id="sk" name="skills" className="input" defaultValue={p.skills.join(', ')} placeholder="React, Node.js, Figma, Pitching" />
            <p className="help">คั่นด้วยจุลภาค · 3 อันแรกจะเป็นทักษะเด่นบนโปรไฟล์</p>
          </div>
          <InterestsField interests={p.interests} domain={p.domain_expertise} />
        </section>

        <section>
          <div className="step-title">
            <span className="step-num">3</span>
            <h2>ลิงก์ และผลงาน</h2>
          </div>
          <div className="field">
            <span className="label">ลิงก์</span>
            <div className="stack" style={{ gap: 8 }}>
              {links.map((l) => (
                <div key={l.k} className="row" style={{ gap: 8 }}>
                  <input name="link_label" className="input" style={{ flex: '0 0 130px' }} defaultValue={l.label} placeholder="Portfolio" aria-label="ชื่อลิงก์" />
                  <input name="link_url" className="input" style={{ flex: 1 }} defaultValue={l.url} placeholder="github.com/you" aria-label="URL" />
                  <button type="button" className="sq-btn" aria-label="ลบลิงก์" onClick={() => setLinks(links.filter((x) => x.k !== l.k))}>
                    <IconClose size={16} />
                  </button>
                </div>
              ))}
              {links.length < 5 && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setLinks([...links, { k: key(), label: '', url: '' }])}>
                  <IconPlus size={16} /> เพิ่มลิงก์
                </button>
              )}
            </div>
          </div>
          <div className="field">
            <span className="label">ผลงาน &amp; ประสบการณ์</span>
            <div className="stack" style={{ gap: 12 }}>
              {exps.map((x) => (
                <div key={x.k} className="stack" style={{ gap: 8, padding: 14, borderRadius: 14, background: 'var(--bg)' }}>
                  <div className="row" style={{ gap: 8 }}>
                    <input name="exp_title" className="input" defaultValue={x.title} placeholder="Finalist · Mahidol Startup Thailand League 2026" aria-label="หัวข้อ" />
                    <button type="button" className="sq-btn" aria-label="ลบรายการ" onClick={() => setExps(exps.filter((y) => y.k !== x.k))}>
                      <IconClose size={16} />
                    </button>
                  </div>
                  <input name="exp_subtitle" className="input" defaultValue={x.subtitle} placeholder="ทีม MedQ · Developer · มี.ค. 2569" aria-label="รายละเอียดสั้น" />
                  <input name="exp_description" className="input" defaultValue={x.description} placeholder="ทำอะไร ได้ผลลัพธ์อะไร" aria-label="คำอธิบาย" />
                </div>
              ))}
              {exps.length < 8 && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setExps([...exps, { k: key(), title: '' }])}>
                  <IconPlus size={16} /> เพิ่มผลงาน
                </button>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="step-title">
            <span className="step-num yellow">4</span>
            <h2>การแสดงโปรไฟล์</h2>
          </div>
          <div className="toggle-row">
            <span className="txt">
              <b>แสดงโปรไฟล์ในเครือข่ายสมาชิก</b>
              <span>สมาชิกคนอื่นจะค้นพบคุณได้จากหน้าเครือข่าย และติดต่อเพื่อชวนร่วมทีมหรือร่วมก่อตั้ง</span>
            </span>
            <Switch checked={isPublic} onChange={setIsPublic} label="แสดงโปรไฟล์ในเครือข่ายสมาชิก" name="profile_public" />
          </div>
          {!isPublic && <p className="help" style={{ margin: 0 }}>โปรไฟล์จะไม่แสดงในหน้าเครือข่าย และหน้าโปรไฟล์ของคุณจะเปิดดูได้เฉพาะคุณ</p>}
        </section>
      </div>
      <div className="form-actions sticky-m autosave" aria-live="polite">
        {state?.error && !pending ? (
          <span className="alert alert-error">{state.error} — แก้แล้วจะบันทึกให้อีกครั้ง</span>
        ) : (
          <span className="autosave-status">{pending || dirty ? 'กำลังบันทึก…' : state?.ok ? '✓ บันทึกแล้ว' : 'บันทึกอัตโนมัติเมื่อแก้ไข'}</span>
        )}
      </div>
    </form>
  )
}
