import Link from 'next/link'
import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import { NotificationTopics, EmailSection } from '@/components/NotificationSettings'
import LineLinkCard from '@/components/LineLinkCard'
import { IconChatSimple, IconLine } from '@/components/icons'
import { requireViewer } from '@/lib/auth'
import { lineMessagingEnabled } from '@/lib/env'

export const metadata: Metadata = { title: 'รับแจ้งเตือนผ่าน LINE' }
export const dynamic = 'force-dynamic'

export default async function NotificationSettingsPage({ searchParams }: PageProps<'/settings/notifications'>) {
  const sp = await searchParams
  const viewer = await requireViewer('/settings/notifications')
  const p = viewer.profile
  const onboarding = sp.onboarding === '1'
  const rawNext = typeof sp.next === 'string' ? sp.next : '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
  const linked = Boolean(p.line_user_id)

  const notices: { kind: 'ok' | 'error'; text: string }[] = []
  if (sp.linked === '1') notices.push({ kind: 'ok', text: 'เชื่อม LINE สำเร็จ 🎉' })
  if (typeof sp.line_error === 'string') notices.push({ kind: 'error', text: sp.line_error })

  return (
    <div style={{ background: 'radial-gradient(100% 40% at 100% 0%, rgba(0,53,173,0.10) 0%, rgba(0,53,173,0) 60%), linear-gradient(180deg, #E6ECF8 0px, #F4F7FC 420px)', lineHeight: 1.65 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px 96px' }} className="stack">
        <div className="stack" style={{ gap: 10, maxWidth: 640, marginBottom: 28 }}>
          {onboarding ? (
            <div className="row muted" style={{ gap: 12, fontSize: 13 }}>
              <span className="progress-steps">
                <span className="on" />
                <span className="on" />
              </span>
              ขั้นที่ 2 จาก 2 · การแจ้งเตือน
            </div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              <Crumbs back="/me" trail={[{ label: 'โปรไฟล์ของฉัน', href: '/me' }, { label: 'รับแจ้งเตือนผ่าน LINE' }]} />
            </div>
          )}
          <h1 style={{ margin: 0, fontWeight: 600, fontSize: 40, lineHeight: 1.2 }}>รับแจ้งเตือนผ่าน LINE</h1>
          <p className="muted" style={{ margin: 0, fontSize: 17 }}>
            ไม่พลาดตอนมีคนชวนเข้าทีม หรือมีงานแข่งที่ใช่ — เลือกได้ว่าอยากรู้เรื่องไหน
          </p>
        </div>

        <div className="stack" style={{ gap: 20 }}>
          {notices.map((n, i) => (
            <div key={i} className={`alert ${n.kind === 'ok' ? 'alert-ok' : 'alert-error'}`}>
              {n.text}
            </div>
          ))}

          <section id="line" className="line-card">
            <div className="stack" style={{ minWidth: 0, gap: 22 }}>
              <div className="row" style={{ gap: 14 }}>
                <span style={{ flex: 'none', width: 48, height: 48, borderRadius: 14, background: '#E7F8EE', color: '#06C755', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconLine size={26} />
                </span>
                <div className="stack" style={{ lineHeight: 1.35 }}>
                  <h2 style={{ margin: 0, fontWeight: 500, fontSize: 22 }}>🔗 เชื่อมต่อ LINE</h2>
                  <span className="muted" style={{ fontSize: 14 }}>
                    บันทึก LINE ของคุณคู่กับบัญชีอีเมล เพื่อรับข่าวสารจาก LINE OA
                  </span>
                </div>
              </div>

              <LineLinkCard p={p} next={onboarding ? `/settings/notifications?onboarding=1&next=${encodeURIComponent(next)}` : '/settings/notifications'} />
            </div>
          </section>

          <NotificationTopics
            initial={{
              notify_invites: p.notify_invites,
              notify_matches: p.notify_matches,
              notify_reminders: p.notify_reminders,
              notify_announcements: p.notify_announcements,
            }}
            frequency={p.notify_frequency}
            lineReady={linked && p.line_is_friend && lineMessagingEnabled()}
          />

          <EmailSection email={p.email} emailNotifications={p.email_notifications} />

          {onboarding ? (
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <Link href={next} className="muted" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 15 }}>
                ข้ามไปก่อน
              </Link>
              <Link href={next} className="btn btn-primary btn-lg" style={{ padding: '0 32px' }}>
                เสร็จสิ้น
              </Link>
            </div>
          ) : (
            <p className="row muted" style={{ fontSize: 13, gap: 8 }}>
              <IconChatSimple size={16} /> การตั้งค่าบันทึกอัตโนมัติทุกครั้งที่กดสวิตช์
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
