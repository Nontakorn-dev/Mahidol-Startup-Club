'use client'
import { useActionState } from 'react'
import { saveSeeker } from '@/app/actions/posts'
import PrivacySection from './PrivacySection'
import EventPicker from './EventPicker'

const ANY = 'เปิดรับทุกรายการ'

type Seeker = { id?: string; looking_text?: string; event_id?: string | null; skills?: string[]; details?: string | null; is_anonymous?: boolean; contact?: string | null }

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
            <h2>ข้อมูลผู้สมัคร</h2>
          </div>
          {/* Open events to pick from; anything else is typed (stored in looking_text). */}
          <EventPicker
            events={events}
            defaultEvent={seeker.event_id ?? (seeker.looking_text && seeker.looking_text !== ANY ? 'other' : defaultEvent ?? '')}
            defaultText={seeker.event_id || seeker.looking_text === ANY ? '' : seeker.looking_text ?? ''}
            emptyLabel="— เปิดรับทุกรายการ —"
          />
          <div className="field">
            <label htmlFor="sk">ทักษะและความถนัด</label>
            <input id="sk" name="skills" className="input" defaultValue={(seeker.skills ?? defaultSkills).join(', ')} placeholder="เช่น Full-stack, React, UX/UI (คั่นด้วยเครื่องหมายจุลภาค สูงสุด 6 รายการ)" />
            <p className="help">ระบบนำมาจากโปรไฟล์ของคุณ สามารถแก้ไขได้</p>
          </div>
          <div className="field">
            <label htmlFor="dt">
              แนะนำตัว <span className="opt">(แนะนำให้กรอก)</span>
            </label>
            <textarea
              id="dt"
              name="details"
              className="textarea"
              rows={7}
              maxLength={4000}
              defaultValue={seeker.details ?? ''}
              placeholder={'ประสบการณ์และผลงานที่เกี่ยวข้อง\nบทบาทที่ต้องการรับผิดชอบในทีม\nเวลาที่สามารถทุ่มเทได้ต่อสัปดาห์\nลิงก์ผลงาน (ถ้ามี)'}
            />
            <p className="help">แสดงในหน้ารายละเอียดของประกาศ (ไม่แสดงบนการ์ด)</p>
          </div>
        </section>
        <PrivacySection num={2} defaultAnonymous={Boolean(seeker.is_anonymous)} defaultContact={seeker.contact} lineLinked={lineLinked} />
      </div>
      {state?.error && <div className="alert alert-error">{state.error}</div>}
      <div className="form-actions sticky-m">
        <button type="submit" className="btn btn-orange btn-lg" style={{ fontWeight: 700, padding: '0 32px' }} disabled={pending}>
          {pending ? 'กำลังบันทึก…' : seeker.id ? 'บันทึกการแก้ไข' : 'เผยแพร่ประกาศ'}
        </button>
      </div>
    </form>
  )
}
