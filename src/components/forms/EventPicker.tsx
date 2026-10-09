'use client'
import { useState } from 'react'

/**
 * One "รายการแข่งขัน" field: pick an open event from the list, or choose "รายการอื่น" and type it.
 * Posts `event` (event id | 'other' | '') and, for 'other', `event_text`.
 */
export default function EventPicker({
  events,
  defaultEvent = '',
  defaultText = '',
  emptyLabel,
  optional,
}: {
  events: { id: string; title: string }[]
  defaultEvent?: string
  defaultText?: string
  emptyLabel: string
  optional?: boolean
}) {
  const [value, setValue] = useState(defaultEvent)
  return (
    <div className="field">
      <label htmlFor="evp">
        รายการแข่งขัน {optional && <span className="opt">(ไม่บังคับ)</span>}
      </label>
      <select id="evp" name="event" className="select" value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">{emptyLabel}</option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
          </option>
        ))}
        <option value="other">รายการอื่น (ระบุเอง)</option>
      </select>
      {value === 'other' && (
        <input
          name="event_text"
          className="input"
          style={{ marginTop: 10 }}
          required
          maxLength={80}
          defaultValue={defaultText}
          placeholder="ระบุชื่อรายการแข่งขัน เช่น Hult Prize 2027"
          aria-label="ชื่อรายการแข่งขัน"
          autoFocus
        />
      )}
      <p className="help">ไม่พบรายการที่ต้องการ? เลือก “รายการอื่น (ระบุเอง)” แล้วพิมพ์ชื่อรายการ</p>
    </div>
  )
}
