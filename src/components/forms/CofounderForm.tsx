'use client'
import { useActionState } from 'react'
import { saveCofounder } from '@/app/actions/posts'
import ChipSelect from '../ChipSelect'
import PrivacySection from './PrivacySection'
import { COMMITMENTS, STAGES, TRACKS, TRACK_KEYS } from '@/lib/constants'

type Cofounder = {
  my_skills?: string[]
  about?: string | null
  seeking?: string[]
  portfolio_url?: string | null
  idea_title?: string | null
  problem?: string | null
  stage?: string
  commitment?: string | null
  is_anonymous?: boolean
}

const trackOptions = TRACK_KEYS.map((k) => ({ value: k, label: TRACKS[k] }))
const stageOptions = (Object.keys(STAGES) as (keyof typeof STAGES)[]).map((k) => ({ value: k, label: STAGES[k] }))

export default function CofounderForm({ c = {}, lineLinked }: { c?: Cofounder; lineLinked: boolean }) {
  const [state, action, pending] = useActionState(saveCofounder, null)
  return (
    <form action={action} className="stack" style={{ gap: 20 }}>
      <div className="sheet">
        <section>
          <div className="step-title">
            <span className="step-num">1</span>
            <h2>เกี่ยวกับคุณ</h2>
          </div>
          <div className="field">
            <span className="label">ทักษะหลักของฉัน</span>
            <ChipSelect name="my_skills" label="สิ่งที่ถนัด" options={trackOptions} defaultValue={c.my_skills} />
          </div>
          <div className="field">
            <label htmlFor="hd">เล่าเพิ่มเติม</label>
            <input id="hd" name="about" className="input" maxLength={160} defaultValue={c.about ?? ''} placeholder="เช่น Full-stack 2 ปี · เคยทำแอปจริง" />
          </div>
          <div className="field">
            <span className="label">กำลังมองหา co-founder สาย</span>
            <ChipSelect name="seeking" label="มองหา" options={trackOptions} defaultValue={c.seeking} />
          </div>
          <div className="field">
            <label htmlFor="lk">
              ลิงก์ผลงาน <span className="opt">(ไม่บังคับ)</span>
            </label>
            <input id="lk" name="portfolio_url" type="url" className="input" defaultValue={c.portfolio_url ?? ''} placeholder="Portfolio, GitHub หรือ LinkedIn" />
          </div>
        </section>
        <section>
          <div className="step-title">
            <span className="step-num">2</span>
            <h2>ไอเดียของคุณ</h2>
          </div>
          <div className="field">
            <label htmlFor="it">ชื่อไอเดีย / สตาร์ตอัพ</label>
            <input id="it" name="idea_title" className="input" required maxLength={80} defaultValue={c.idea_title ?? ''} placeholder="เช่น ระบบจองคิว OPD" />
          </div>
          <div className="field">
            <label htmlFor="idd">ปัญหาที่อยากแก้</label>
            <textarea id="idd" name="problem" className="textarea" rows={4} required maxLength={1500} defaultValue={c.problem ?? ''} placeholder="ใครเจอปัญหานี้ และคุณอยากแก้ยังไง" />
          </div>
          <div className="field">
            <span className="label">ไอเดียไปถึงขั้นไหนแล้ว</span>
            <ChipSelect name="stage" label="ขั้นของไอเดีย" single options={stageOptions} defaultValue={[c.stage ?? 'idea']} />
          </div>
          <div className="field">
            <label htmlFor="cm">เวลาที่ทุ่มเทได้</label>
            <select id="cm" name="commitment" className="select" defaultValue={c.commitment ?? COMMITMENTS[0]}>
              {COMMITMENTS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
        </section>
        <PrivacySection defaultAnonymous={Boolean(c.is_anonymous)} lineLinked={lineLinked} />
      </div>
      {state?.error && <div className="alert alert-error">{state.error}</div>}
      <div className="form-actions sticky-m">
        <button type="submit" name="intent" value="draft" className="btn btn-outline btn-lg" disabled={pending}>
          บันทึกร่าง
        </button>
        <button type="submit" name="intent" value="publish" className="btn btn-orange btn-lg" style={{ fontWeight: 700, fontSize: 17, padding: '0 32px' }} disabled={pending}>
          {pending ? 'กำลังบันทึก…' : 'เผยแพร่โปรไฟล์'}
        </button>
      </div>
    </form>
  )
}
