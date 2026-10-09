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
  details?: string | null
  contact?: string | null
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
            <h2>ข้อมูลของคุณ</h2>
          </div>
          <div className="field">
            <span className="label">ความเชี่ยวชาญของคุณ</span>
            <ChipSelect name="my_skills" label="ความเชี่ยวชาญของคุณ" options={trackOptions} defaultValue={c.my_skills} />
          </div>
          <div className="field">
            <label htmlFor="hd">ประสบการณ์โดยย่อ</label>
            <input id="hd" name="about" className="input" maxLength={160} defaultValue={c.about ?? ''} placeholder="เช่น นักพัฒนา Full-stack 2 ปี เคยพัฒนาแอปที่มีผู้ใช้จริง" />
          </div>
          <div className="field">
            <span className="label">ต้องการ Co-Founder ด้าน</span>
            <ChipSelect name="seeking" label="ต้องการ Co-Founder ด้าน" options={trackOptions} defaultValue={c.seeking} />
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
            <h2>ข้อมูลโปรเจกต์</h2>
          </div>
          <div className="field">
            <label htmlFor="it">ชื่อโปรเจกต์หรือสตาร์ตอัพ</label>
            <input id="it" name="idea_title" className="input" required maxLength={80} defaultValue={c.idea_title ?? ''} placeholder="เช่น ระบบจองคิว OPD" />
          </div>
          <div className="field">
            <label htmlFor="idd">ปัญหาที่ต้องการแก้ไข</label>
            <textarea id="idd" name="problem" className="textarea" rows={4} required maxLength={1500} defaultValue={c.problem ?? ''} placeholder="กลุ่มเป้าหมายคือใคร และพบปัญหาอะไร" />
          </div>
          <div className="field">
            <span className="label">ความคืบหน้าของโปรเจกต์</span>
            <ChipSelect name="stage" label="ความคืบหน้าของโปรเจกต์" single options={stageOptions} defaultValue={[c.stage ?? 'idea']} />
          </div>
          <div className="field">
            <label htmlFor="cm">เวลาที่สามารถทุ่มเทได้</label>
            <select id="cm" name="commitment" className="select" defaultValue={c.commitment ?? COMMITMENTS[0]}>
              {COMMITMENTS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cd">
              รายละเอียดเพิ่มเติม <span className="opt">(แนะนำให้กรอก)</span>
            </label>
            <textarea
              id="cd"
              name="details"
              className="textarea"
              rows={7}
              maxLength={4000}
              defaultValue={c.details ?? ''}
              placeholder={'แนวทางการแก้ปัญหาและกลุ่มลูกค้า\nสิ่งที่ทำไปแล้ว และแผนในระยะ 3–6 เดือน\nบทบาทและความคาดหวังต่อ Co-Founder\nลิงก์เอกสารหรือต้นแบบ (ถ้ามี)'}
            />
            <p className="help">แสดงในหน้ารายละเอียดของประกาศ (ไม่แสดงบนการ์ด)</p>
          </div>
        </section>
        <PrivacySection defaultAnonymous={Boolean(c.is_anonymous)} defaultContact={c.contact} lineLinked={lineLinked} />
      </div>
      {state?.error && <div className="alert alert-error">{state.error}</div>}
      <div className="form-actions sticky-m">
        <button type="submit" name="intent" value="draft" className="btn btn-outline btn-lg" disabled={pending}>
          บันทึกร่าง
        </button>
        <button type="submit" name="intent" value="publish" className="btn btn-orange btn-lg" style={{ fontWeight: 700, fontSize: 17, padding: '0 32px' }} disabled={pending}>
          {pending ? 'กำลังบันทึก…' : 'เผยแพร่ประกาศ'}
        </button>
      </div>
    </form>
  )
}
