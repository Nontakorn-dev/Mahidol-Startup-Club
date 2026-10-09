'use client'
import { useActionState, useRef, useState } from 'react'
import AvatarCropper from '../AvatarCropper'
import { saveProfile } from '@/app/actions/profile'
import Avatar from '../Avatar'
import ChipSelect from '../ChipSelect'
import Switch from '../Switch'
import { IconClose, IconPlus } from '../icons'
import { CAMPUSES, FACULTIES, ROLES, ROLE_KEYS, YEARS } from '@/lib/constants'
import type { Profile } from '@/lib/types'

type Exp = { k: number; title: string; subtitle?: string; description?: string }
type LinkRow = { k: number; label: string; url: string }
let seq = 0
const key = () => ++seq

export default function ProfileForm({ p }: { p: Profile }) {
  const [state, action, pending] = useActionState(saveProfile, null)
  const [links, setLinks] = useState<LinkRow[]>(() => (p.links.length ? p.links : [{ label: 'GitHub', url: '' }]).map((l) => ({ ...l, k: key() })))
  const [exps, setExps] = useState<Exp[]>(() => p.experiences.map((x) => ({ ...x, k: key() })))
  const [preview, setPreview] = useState<string | null>(p.avatar_url)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [isPublic, setIsPublic] = useState(p.profile_public ?? true)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <form action={action} className="stack" style={{ gap: 20 }}>
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
                <span style={{ fontSize: 12, color: 'var(--ok)' }}>✓ จัดรูปแล้ว — กด “บันทึก” ด้านล่างเพื่อใช้รูปนี้</span>
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
            <h2>ทักษะ ความสนใจ และความพร้อม</h2>
          </div>
          <div className="field">
            <label htmlFor="sk">ทักษะ</label>
            <input id="sk" name="skills" className="input" defaultValue={p.skills.join(', ')} placeholder="React, Node.js, Figma, Pitching" />
            <p className="help">คั่นด้วยจุลภาค · 3 อันแรกจะเป็นทักษะเด่นบนโปรไฟล์</p>
          </div>
          <div className="field">
            <span className="label">อยากได้ยินเรื่องงานสายไหน</span>
            <ChipSelect name="interests" label="สายที่สนใจ" options={ROLE_KEYS.map((k) => ({ value: k, label: ROLES[k] }))} defaultValue={p.interests} />
          </div>
          <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="field">
              <label htmlFor="av">เวลาว่าง</label>
              <input id="av" name="availability" className="input" defaultValue={p.availability ?? ''} placeholder="~10 ชม. / สัปดาห์" />
            </div>
            <div className="field">
              <label htmlFor="wm">รูปแบบ</label>
              <input id="wm" name="work_mode" className="input" defaultValue={p.work_mode ?? ''} placeholder="Online + ศาลายา" />
            </div>
            <div className="field">
              <label htmlFor="sw">เริ่มได้</label>
              <input id="sw" name="start_when" className="input" defaultValue={p.start_when ?? ''} placeholder="ทันที" />
            </div>
          </div>
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
      {state?.error && <div className="alert alert-error">{state.error}</div>}
      {state?.ok && <div className="alert alert-ok">{state.ok}</div>}
      <div className="form-actions sticky-m">
        <button type="submit" className="btn btn-orange btn-lg" style={{ padding: '0 32px', fontWeight: 700 }} disabled={pending}>
          {pending ? 'กำลังบันทึก…' : 'บันทึกโปรไฟล์'}
        </button>
      </div>
    </form>
  )
}
