'use client'
/* eslint-disable @next/next/no-img-element */
import { useActionState, useState } from 'react'
import { sendBroadcast } from '@/app/actions/admin'
import Switch from '../Switch'

export default function BroadcastForm({ events }: { events: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(sendBroadcast, null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [audience, setAudience] = useState('subscribers')
  const [line, setLine] = useState(true)
  const [email, setEmail] = useState(true)
  const [img, setImg] = useState<string | null>(null)
  return (
    <form
      action={action}
      className="box"
      style={{ gap: 16 }}
      onSubmit={(e) => {
        if (!confirm('ส่งประกาศนี้ตอนนี้เลย? ส่งแล้วยกเลิกไม่ได้')) e.preventDefault()
      }}
    >
      <h2>เขียนประกาศ</h2>
      <div className="field">
        <label htmlFor="bt">หัวข้อ</label>
        <input id="bt" name="title" className="input" required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น Workshop Pitch Deck 101 เสาร์นี้" />
      </div>
      <div className="field">
        <label htmlFor="bb">ข้อความ</label>
        <textarea id="bb" name="body" className="textarea" rows={4} required maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="รายละเอียดสั้นๆ วันเวลา สถานที่" />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="bu">
            ลิงก์ <span className="opt">(ไม่บังคับ)</span>
          </label>
          <input id="bu" name="url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… หรือ /opportunities/..." />
        </div>
        <div className="field">
          <label htmlFor="bi">
            รูป <span className="opt">(ไม่บังคับ)</span>
          </label>
          <input
            id="bi"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="input"
            style={{ paddingTop: 10 }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              setImg(f ? URL.createObjectURL(f) : null)
            }}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ba">ส่งถึง</label>
        <select id="ba" name="audience" className="select" value={audience} onChange={(e) => setAudience(e.target.value)}>
          <option value="subscribers">คนที่เปิดรับ “ประกาศจากชมรม”</option>
          <option value="all">ทุกคน (ประกาศสำคัญ — ไม่สนการตั้งค่าหัวข้อ)</option>
          <option value="saved_event">คนที่บันทึกงาน…</option>
        </select>
      </div>
      {audience === 'saved_event' && (
        <div className="field">
          <label htmlFor="be">งาน</label>
          <select id="be" name="audience_event_id" className="select" required>
            <option value="">— เลือกงาน —</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="toggle-row">
        <span className="txt">
          <b>ส่งทาง LINE OA</b>
          <span>สำหรับคนที่เชื่อม LINE และเพิ่มเพื่อนแล้ว</span>
        </span>
        <Switch checked={line} onChange={setLine} label="ส่งทาง LINE" name="send_line" />
      </div>
      <div className="toggle-row">
        <span className="txt">
          <b>ส่งทางอีเมล</b>
          <span>สำหรับคนที่ยังไม่ได้เชื่อม LINE (หรือส่ง LINE ไม่สำเร็จ)</span>
        </span>
        <Switch checked={email} onChange={setEmail} label="ส่งทางอีเมล" name="send_email" />
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
          ตัวอย่างบน LINE
        </span>
        <div className="line-preview" style={{ maxWidth: 340 }}>
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <span className="msc-dot">MSC</span>
            <div style={{ flex: 1, minWidth: 0, borderRadius: 18, background: '#fff', overflow: 'hidden', boxShadow: '0 4px 14px -6px rgba(16,35,63,0.2)' }}>
              <div style={{ padding: '10px 14px', background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 600 }}>ประกาศจากชมรม</div>
              {img && <img src={img} alt="" style={{ display: 'block', width: '100%', height: 150, objectFit: 'cover' }} />}
              <div className="stack" style={{ padding: 14, gap: 6 }}>
                <span className="head" style={{ fontWeight: 500, fontSize: 16, lineHeight: 1.3 }}>
                  {title || 'หัวข้อประกาศ'}
                </span>
                <span className="muted" style={{ fontSize: 13, whiteSpace: 'pre-line' }}>
                  {body || 'ข้อความ'}
                </span>
              </div>
              <div style={{ padding: '0 14px 14px' }}>
                <span className="btn btn-primary btn-sm btn-block" style={{ pointerEvents: 'none' }}>
                  {url ? 'ดูรายละเอียด' : 'เปิดเว็บ'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {state?.error && <div className="alert alert-error">{state.error}</div>}
      {state?.ok && <div className="alert alert-ok">{state.ok}</div>}
      <button type="submit" className="btn btn-orange btn-lg" disabled={pending}>
        {pending ? 'กำลังส่ง…' : 'ส่งประกาศ'}
      </button>
    </form>
  )
}
