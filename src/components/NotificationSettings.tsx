'use client'
import { useActionState, useState, useTransition } from 'react'
import { requestEmailVerification, setNotificationPref, unlinkLine } from '@/app/actions/profile'
import { NOTIFY_TOPICS, type NotifyTopicKey } from '@/lib/constants'
import Switch from './Switch'

export function NotificationTopics({
  initial,
  frequency,
  lineReady,
}: {
  initial: Record<NotifyTopicKey, boolean>
  frequency: 'instant' | 'daily'
  lineReady: boolean
}) {
  const [prefs, setPrefs] = useState(initial)
  const [freq, setFreq] = useState(frequency)
  const [error, setError] = useState<string | null>(null)
  const [, start] = useTransition()
  const save = (key: string, value: boolean | string, revert: () => void) =>
    start(async () => {
      const res = await setNotificationPref(key, value)
      if (res.error) {
        setError(res.error)
        revert()
      }
    })
  return (
    <section className="card stack" style={{ padding: 28, gap: 8 }}>
      <h2 style={{ margin: '0 0 8px', fontWeight: 500, fontSize: 22 }}>อยากรู้เรื่องไหนบ้าง</h2>
      {NOTIFY_TOPICS.map((t, i) => (
        <div key={t.key} className="topic-row">
          <span className="topic-num">{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span className="row wrap" style={{ gap: 8, fontWeight: 600, fontSize: 16 }}>
              {t.title}
              {'recommended' in t && t.recommended && (
                <span style={{ padding: '1px 8px', borderRadius: 999, background: 'var(--yellow)', fontSize: 11, fontWeight: 600 }}>แนะนำ</span>
              )}
            </span>
            <span className="muted" style={{ fontSize: 14 }}>
              {t.desc}
            </span>
          </span>
          <Switch
            checked={prefs[t.key]}
            label={t.title}
            onChange={(v) => {
              setPrefs((p) => ({ ...p, [t.key]: v }))
              save(t.key, v, () => setPrefs((p) => ({ ...p, [t.key]: !v })))
            }}
          />
        </div>
      ))}
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12, paddingTop: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>ความถี่</span>
        <div role="radiogroup" aria-label="ความถี่" className="segmented">
          {(
            [
              ['instant', 'ทันที'],
              ['daily', 'สรุปวันละครั้ง'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={freq === v}
              onClick={() => {
                const prev = freq
                setFreq(v)
                save('notify_frequency', v, () => setFreq(prev))
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
        {lineReady ? 'แจ้งเตือนจะส่งทาง LINE OA' : 'ยังไม่เชื่อม LINE? เราจะส่งเรื่องเหล่านี้ทางอีเมลแทน'}
      </p>
    </section>
  )
}

export function UnlinkLineButton() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <button
        type="button"
        className="btn btn-outline"
        disabled={pending}
        onClick={() => {
          if (!confirm('ยกเลิกการเชื่อม LINE? คุณจะไม่ได้รับแจ้งเตือนทาง LINE อีก')) return
          start(async () => {
            const res = await unlinkLine()
            if (res.error) setError(res.error)
          })
        }}
      >
        ยกเลิกการเชื่อม
      </button>
      {error && (
        <span className="alert alert-error" style={{ width: '100%' }}>
          {error}
        </span>
      )}
    </>
  )
}

export function EmailSection({ email, emailNotifications, canSendEmail }: { email: string | null; emailNotifications: boolean; canSendEmail: boolean }) {
  const [on, setOn] = useState(emailNotifications)
  const [, start] = useTransition()
  const [state, action, pending] = useActionState(requestEmailVerification, null)
  return (
    <section className="card stack" style={{ padding: 28, gap: 14 }}>
      <h2 style={{ margin: 0, fontWeight: 500, fontSize: 22 }}>อีเมล</h2>
      {email ? (
        <div className="toggle-row">
          <span className="txt">
            <b>รับข่าวสารทางอีเมล ({email})</b>
            <span>ใช้เมื่อยังไม่ได้เชื่อม LINE หรือส่ง LINE ไม่สำเร็จ</span>
          </span>
          <Switch
            checked={on}
            label="รับข่าวสารทางอีเมล"
            onChange={(v) => {
              setOn(v)
              start(async () => {
                const res = await setNotificationPref('email_notifications', v)
                if (res.error) setOn(!v)
              })
            }}
          />
        </div>
      ) : (
        <form action={action} className="stack" style={{ gap: 10 }}>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            บัญชีนี้สมัครผ่าน LINE — เพิ่มอีเมลเพื่อใช้เข้าสู่ระบบสำรองและรับข่าวสารทางอีเมล
          </p>
          <div className="row" style={{ gap: 8 }}>
            <input name="email" type="email" required className="input" placeholder="you@student.mahidol.ac.th" style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary" disabled={pending || !canSendEmail}>
              {pending ? 'กำลังส่ง…' : 'ยืนยันอีเมล'}
            </button>
          </div>
          {!canSendEmail && <span className="muted" style={{ fontSize: 13 }}>ระบบส่งอีเมลยังไม่ได้ตั้งค่า</span>}
          {state?.error && <div className="alert alert-error">{state.error}</div>}
          {state?.ok && <div className="alert alert-ok">{state.ok}</div>}
        </form>
      )}
    </section>
  )
}
