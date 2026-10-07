'use client'
import { useActionState, useState } from 'react'
import { saveTeam } from '@/app/actions/posts'
import ChipSelect from '../ChipSelect'
import PrivacySection from './PrivacySection'
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
            <h2>เกี่ยวกับทีม</h2>
          </div>
          <div className="field">
            <label htmlFor="tn">ชื่อทีม / โปรเจกต์</label>
            <input id="tn" name="name" className="input" required maxLength={60} defaultValue={team.name} placeholder="เช่น CareLoop" />
          </div>
          <div className="field">
            <label htmlFor="tc">ลงงานแข่งไหน</label>
            <select id="tc" name="event" className="select" defaultValue={eventDefault}>
              <option value="">— ยังไม่ได้เลือก —</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
              <option value="other">งานแข่งอื่นๆ / ยังไม่แน่ใจ</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="tp">ไอเดียในหนึ่งประโยค</label>
            <input
              id="tp"
              name="pitch"
              className="input"
              required
              maxLength={120}
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              placeholder="เช่น แอปติดตามการกินยาผู้สูงอายุ เชื่อมผู้ดูแลผ่าน LINE"
            />
            <p className="count">{pitch.length}/120</p>
          </div>
          <div className="field">
            <label htmlFor="td">
              รายละเอียดเพิ่มเติม <span className="opt">(ไม่บังคับ)</span>
            </label>
            <textarea id="td" name="details" className="textarea" rows={4} maxLength={2000} defaultValue={team.details ?? ''} placeholder="ปัญหาที่อยากแก้ ตอนนี้ทำถึงไหนแล้ว ลิงก์ prototype" />
          </div>
        </section>
        <section>
          <div className="step-title">
            <span className="step-num">2</span>
            <h2>สมาชิกตอนนี้ และคนที่กำลังมองหา</h2>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="cur">ตอนนี้มีกี่คน</label>
              <input id="cur" name="members_count" type="number" min={1} max={20} className="input" defaultValue={team.members_count ?? 1} />
            </div>
            <div className="field">
              <label htmlFor="tot">อยากให้ทีมมีกี่คน</label>
              <input id="tot" name="target_size" type="number" min={2} max={30} className="input" defaultValue={team.target_size ?? 4} />
            </div>
          </div>
          <div className="field">
            <span className="label">ทักษะที่ทีมมีแล้ว</span>
            <ChipSelect name="has_skills" label="ทีมมีสกิล" options={roleOptions} defaultValue={team.has_skills} />
          </div>
          <div className="field">
            <span className="label">
              ตำแหน่งที่กำลังมองหา <span className="opt">(เลือกได้หลายอัน)</span>
            </span>
            <ChipSelect name="roles_needed" label="ตำแหน่งที่กำลังมองหา" options={roleOptions} defaultValue={team.roles_needed} />
          </div>
        </section>
        <PrivacySection defaultAnonymous={Boolean(team.is_anonymous)} lineLinked={lineLinked} />
      </div>
      {state?.error && <div className="alert alert-error">{state.error}</div>}
      <div className="form-actions sticky-m">
        <button type="submit" name="intent" value="draft" className="btn btn-outline btn-lg" disabled={pending}>
          บันทึกร่าง
        </button>
        <button type="submit" name="intent" value="publish" className="btn btn-orange btn-lg" style={{ fontWeight: 700, fontSize: 17, padding: '0 32px' }} disabled={pending}>
          {pending ? 'กำลังบันทึก…' : team.id ? 'อัปเดตประกาศ' : 'เผยแพร่ประกาศ'}
        </button>
      </div>
    </form>
  )
}
