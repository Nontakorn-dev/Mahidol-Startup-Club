'use client'
import { useActionState } from 'react'
import { saveOnboarding } from '@/app/actions/profile'
import ChipSelect from '../ChipSelect'
import { CAMPUSES, FACULTIES, ROLES, ROLE_KEYS, YEARS } from '@/lib/constants'

type P = {
  first_name: string
  last_name: string
  faculty: string | null
  year: string | null
  campus: string | null
  headline: string | null
  skills: string[]
  interests: string[]
}

export default function OnboardingForm({ p, next }: { p: P; next: string }) {
  const [state, action, pending] = useActionState(saveOnboarding, null)
  return (
    <form action={action} className="stack" style={{ gap: 20 }}>
      <input type="hidden" name="next" value={next} />
      <div className="sheet">
        <section>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="fn">ชื่อ</label>
              <input id="fn" name="first_name" className="input" required maxLength={40} defaultValue={p.first_name} />
            </div>
            <div className="field">
              <label htmlFor="ln">นามสกุล</label>
              <input id="ln" name="last_name" className="input" maxLength={40} defaultValue={p.last_name} />
              <p className="help">บนเว็บจะแสดงแค่ตัวอักษรแรก เช่น “พิมพ์ชนก ส.”</p>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="fa">คณะ</label>
              <select id="fa" name="faculty" className="select" defaultValue={p.faculty ?? ''}>
                <option value="">— เลือกคณะ —</option>
                {FACULTIES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="yr">ชั้นปี</label>
              <select id="yr" name="year" className="select" defaultValue={p.year ?? ''}>
                <option value="">— เลือกชั้นปี —</option>
                {YEARS.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="cp">
              วิทยาเขต <span className="opt">(ไม่บังคับ)</span>
            </label>
            <select id="cp" name="campus" className="select" defaultValue={p.campus ?? ''}>
              <option value="">—</option>
              {CAMPUSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="hl">แนะนำตัวในหนึ่งบรรทัด</label>
            <input id="hl" name="headline" className="input" maxLength={100} defaultValue={p.headline ?? ''} placeholder="เช่น Full-stack developer · สนใจ HealthTech" />
          </div>
          <div className="field">
            <label htmlFor="sk">ทักษะ</label>
            <input id="sk" name="skills" className="input" defaultValue={p.skills.join(', ')} placeholder="เช่น React, Figma, Pitching (คั่นด้วยจุลภาค)" />
          </div>
          <div className="field">
            <span className="label">อยากได้ยินเรื่องงานสายไหน</span>
            <ChipSelect name="interests" label="สายที่สนใจ" options={ROLE_KEYS.map((k) => ({ value: k, label: ROLES[k] }))} defaultValue={p.interests} />
            <p className="help">ใช้คัด “งานแข่งที่ตรงกับคุณ” ส่งให้ทาง LINE หรืออีเมล</p>
          </div>
        </section>
      </div>
      {state?.error && <div className="alert alert-error">{state.error}</div>}
      <div className="form-actions sticky-m">
        <button type="submit" className="btn btn-primary btn-lg" style={{ padding: '0 32px' }} disabled={pending}>
          {pending ? 'กำลังบันทึก…' : 'ถัดไป: การแจ้งเตือน'}
        </button>
      </div>
    </form>
  )
}
