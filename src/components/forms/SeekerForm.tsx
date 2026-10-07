'use client'
import { useActionState } from 'react'
import { saveSeeker } from '@/app/actions/posts'
import PrivacySection from './PrivacySection'

type Seeker = { id?: string; looking_text?: string; event_id?: string | null; skills?: string[]; details?: string | null; is_anonymous?: boolean }

export default function SeekerForm({
  seeker = {},
  events,
  defaultEvent,
  defaultSkills,
  lineLinked,
}: {
  seeker?: Seeker
  events: { id: string; title: string }[]
  defaultEvent?: string
  defaultSkills: string[]
  lineLinked: boolean
}) {
  const [state, action, pending] = useActionState(saveSeeker, null)
  return (
    <form action={action} className="stack" style={{ gap: 20 }}>
      {seeker.id && <input type="hidden" name="id" value={seeker.id} />}
      <div className="sheet">
        <section>
          <div className="step-title">
            <span className="step-num">1</span>
            <h2>กำลังมองหาทีมแบบไหน</h2>
          </div>
          <div className="field">
            <label htmlFor="lt">กำลังมองหา</label>
            <input id="lt" name="looking_text" className="input" required maxLength={80} defaultValue={seeker.looking_text} placeholder="เช่น ทีมลง TED Youth Startup / ทีมสายสุขภาพ" />
          </div>
          <div className="field">
            <label htmlFor="ev">
              อยากลงงานไหน <span className="opt">(ไม่บังคับ)</span>
            </label>
            <select id="ev" name="event" className="select" defaultValue={seeker.event_id ?? defaultEvent ?? ''}>
              <option value="">— ยังไม่แน่ใจ / งานไหนก็ได้ —</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sk">ทักษะที่อยากโชว์</label>
            <input id="sk" name="skills" className="input" defaultValue={(seeker.skills ?? defaultSkills).join(', ')} placeholder="เช่น Full-stack, React (คั่นด้วยจุลภาค สูงสุด 6)" />
            <p className="help">ดึงจากโปรไฟล์ให้แล้ว แก้ได้ตามต้องการ</p>
          </div>
          <div className="field">
            <label htmlFor="dt">
              เล่าเพิ่มเติม <span className="opt">(ไม่บังคับ)</span>
            </label>
            <textarea id="dt" name="details" className="textarea" rows={3} maxLength={1000} defaultValue={seeker.details ?? ''} placeholder="ถนัดอะไร มีเวลาเท่าไหร่ สนใจปัญหาแบบไหน" />
          </div>
        </section>
        <PrivacySection num={2} defaultAnonymous={Boolean(seeker.is_anonymous)} lineLinked={lineLinked} />
      </div>
      {state?.error && <div className="alert alert-error">{state.error}</div>}
      <div className="form-actions sticky-m">
        <button type="submit" className="btn btn-orange btn-lg" style={{ fontWeight: 700, padding: '0 32px' }} disabled={pending}>
          {pending ? 'กำลังบันทึก…' : seeker.id ? 'อัปเดตประกาศ' : 'เผยแพร่ประกาศ'}
        </button>
      </div>
    </form>
  )
}
