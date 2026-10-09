'use client'
import { useActionState, useState } from 'react'
import { saveTeam } from '@/app/actions/posts'
import ChipSelect from '../ChipSelect'
import PrivacySection from './PrivacySection'
import EventPicker from './EventPicker'
import { ROLES, ROLE_KEYS } from '@/lib/constants'

type Team = {
  id?: string
  name?: string
  event_id?: string | null
  event_note?: string | null
  pitch?: string
  details?: string | null
  members_count?: number
  target_size?: number
  has_skills?: string[]
  roles_needed?: string[]
  is_anonymous?: boolean
  contact?: string | null
}

const roleOptions = ROLE_KEYS.map((k) => ({ value: k, label: ROLES[k] }))

export default function TeamForm({
  team = {},
  events,
  defaultEvent,
  lineLinked,
}: {
  team?: Team
  events: { id: string; title: string }[]
  defaultEvent?: string
  lineLinked: boolean
}) {
  const [state, action, pending] = useActionState(saveTeam, null)
  const [pitch, setPitch] = useState(team.pitch ?? '')
  const eventDefault = team.event_id ?? (team.event_note ? 'other' : defaultEvent ?? '')
  return (
    <form action={action} className="stack" style={{ gap: 20 }}>
      {team.id && <input type="hidden" name="id" value={team.id} />}
      <div className="sheet">
        <section>
          <div className="step-title">
            <span className="step-num">1</span>
            <h2>ข้อมูลทีม</h2>
          </div>
          <div className="field">
            <label htmlFor="tn">ชื่อทีมหรือชื่อโปรเจกต์</label>
            <input id="tn" name="name" className="input" required maxLength={60} defaultValue={team.name} placeholder="เช่น CareLoop" />
          </div>
          <EventPicker events={events} defaultEvent={eventDefault} defaultText={team.event_id ? '' : team.event_note ?? ''} emptyLabel="— เลือกรายการแข่งขัน —" />
          <div className="field">
            <label htmlFor="tp">สรุปโปรเจกต์ในหนึ่งประโยค</label>
            <input
              id="tp"
              name="pitch"
              className="input"
              required
              maxLength={120}
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              placeholder="เช่น แอปติดตามการรับประทานยาของผู้สูงอายุ เชื่อมกับผู้ดูแลผ่าน LINE"
            />
            <p className="count">{pitch.length}/120</p>
          </div>
          <div className="field">
            <label htmlFor="td">
              รายละเอียดโปรเจกต์ <span className="opt">(แนะนำให้กรอก)</span>
            </label>
            <textarea
              id="td"
              name="details"
              className="textarea"
              rows={8}
              maxLength={4000}
              defaultValue={team.details ?? ''}
              placeholder={'ปัญหาที่ต้องการแก้ไขและแนวทางของทีม\nความคืบหน้าปัจจุบัน (เช่น มีต้นแบบแล้ว)\nหน้าที่ของสมาชิกใหม่ และกำหนดการสำคัญ\nลิงก์เอกสารหรือผลงาน (ถ้ามี)'}
            />
            <p className="help">แสดงในหน้ารายละเอียดของประกาศ (ไม่แสดงบนการ์ด) — ยิ่งชัดเจน ยิ่งได้สมาชิกที่ตรงกับทีม</p>
          </div>
        </section>
        <section>
          <div className="step-title">
            <span className="step-num">2</span>
            <h2>สมาชิกและตำแหน่งที่ต้องการ</h2>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="cur">จำนวนสมาชิกปัจจุบัน</label>
              <input id="cur" name="members_count" type="number" min={1} max={20} className="input" defaultValue={team.members_count ?? 1} />
            </div>
            <div className="field">
              <label htmlFor="tot">จำนวนสมาชิกที่ต้องการทั้งหมด</label>
              <input id="tot" name="target_size" type="number" min={2} max={30} className="input" defaultValue={team.target_size ?? 4} />
            </div>
          </div>
          <div className="field">
            <span className="label">ทักษะที่ทีมมีอยู่แล้ว</span>
            <ChipSelect name="has_skills" label="ทีมมีสกิล" options={roleOptions} defaultValue={team.has_skills} />
          </div>
          <div className="field">
            <span className="label">
              ตำแหน่งที่ต้องการ <span className="opt">(เลือกได้มากกว่า 1)</span>
            </span>
            <ChipSelect name="roles_needed" label="ตำแหน่งที่ต้องการ" options={roleOptions} defaultValue={team.roles_needed} />
          </div>
        </section>
        <PrivacySection defaultAnonymous={Boolean(team.is_anonymous)} defaultContact={team.contact} lineLinked={lineLinked} />
      </div>
      {state?.error && <div className="alert alert-error">{state.error}</div>}
      <div className="form-actions sticky-m">
        <button type="submit" name="intent" value="draft" className="btn btn-outline btn-lg" disabled={pending}>
          บันทึกร่าง
        </button>
        <button type="submit" name="intent" value="publish" className="btn btn-orange btn-lg" style={{ fontWeight: 700, fontSize: 17, padding: '0 32px' }} disabled={pending}>
          {pending ? 'กำลังบันทึก…' : team.id ? 'บันทึกการแก้ไข' : 'เผยแพร่ประกาศ'}
        </button>
      </div>
    </form>
  )
}
