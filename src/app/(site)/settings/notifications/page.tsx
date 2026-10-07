import Link from 'next/link'
import QRCode from 'qrcode'
import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import { NotificationTopics, UnlinkLineButton, EmailSection } from '@/components/NotificationSettings'
import { IconChatSimple, IconLine, IconQr, IconShield } from '@/components/icons'
import { requireViewer } from '@/lib/auth'
import { emailEnabled, lineAddFriendUrl, lineLoginEnabled, lineMessagingEnabled } from '@/lib/env'

export const metadata: Metadata = { title: 'รับแจ้งเตือนผ่าน LINE' }
export const dynamic = 'force-dynamic'

export default async function NotificationSettingsPage({ searchParams }: PageProps<'/settings/notifications'>) {
  const sp = await searchParams
  const viewer = await requireViewer('/settings/notifications')
  const p = viewer.profile
  const onboarding = sp.onboarding === '1'
  const rawNext = typeof sp.next === 'string' ? sp.next : '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
  const addFriend = lineAddFriendUrl()
  const qrSvg = addFriend ? await QRCode.toString(addFriend, { type: 'svg', margin: 1, color: { dark: '#10233F', light: '#FFFFFF' } }) : null
  const linked = Boolean(p.line_user_id)
  const linkHref = `/api/auth/line/start?mode=link&next=${encodeURIComponent(onboarding ? `/settings/notifications?onboarding=1&next=${encodeURIComponent(next)}` : '/settings/notifications')}`

  const notices: { kind: 'ok' | 'error'; text: string }[] = []
  if (sp.linked === '1') notices.push({ kind: 'ok', text: 'เชื่อม LINE สำเร็จ 🎉' })
  if (typeof sp.line_error === 'string') notices.push({ kind: 'error', text: sp.line_error })
  if (sp.email === 'verified') notices.push({ kind: 'ok', text: 'ยืนยันอีเมลเรียบร้อย' })
  if (typeof sp.email_error === 'string') notices.push({ kind: 'error', text: sp.email_error })

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
                  <h2 style={{ margin: 0, fontWeight: 500, fontSize: 22 }}>{linked ? 'เชื่อม LINE แล้ว' : 'เชื่อมบัญชี LINE'}</h2>
                  <span className="muted" style={{ fontSize: 14 }}>
                    {linked ? `บัญชี LINE: ${p.line_display_name ?? '—'}` : 'ใช้เวลาไม่ถึง 1 นาที'}
                  </span>
                </div>
              </div>

              {linked ? (
                <div className="stack" style={{ gap: 14 }}>
                  {p.line_is_friend ? (
                    <div className="alert alert-ok">พร้อมรับข่าวสารผ่าน LINE OA แล้ว ✓</div>
                  ) : (
                    <div className="alert alert-info">
                      ยังไม่ได้เพิ่มเพื่อน Mahidol Startup Club — เพิ่มเพื่อนก่อน ระบบจึงส่งข้อความหาคุณได้ (ระหว่างนี้จะส่งทางอีเมลแทน)
                    </div>
                  )}
                  <div className="row" style={{ gap: 20, padding: 16, borderRadius: 18, background: 'var(--bg)' }}>
                    {qrSvg && <div className="qr-box" style={{ borderStyle: 'solid' }} dangerouslySetInnerHTML={{ __html: qrSvg }} />}
                    <div className="stack" style={{ flex: 1, minWidth: 0, gap: 10 }}>
                      <span className="stack" style={{ lineHeight: 1.45 }}>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{p.line_is_friend ? 'เปิดแชต LINE OA' : 'เพิ่มเพื่อน LINE OA'}</span>
                        <span className="muted" style={{ fontSize: 13 }}>
                          พิมพ์สิ่งที่อยากทำในแชตได้เลย เช่น “หาทีมลง TED Youth” แล้ว AI จะส่งงานที่ตรงให้
                        </span>
                      </span>
                      <span className="row wrap" style={{ gap: 8 }}>
                        {addFriend && (
                          <a href={addFriend} target="_blank" rel="noopener" className="btn btn-line">
                            <IconLine size={20} />
                            {p.line_is_friend ? 'เปิด LINE OA' : 'เพิ่มเพื่อน'}
                          </a>
                        )}
                        <UnlinkLineButton />
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="stack" style={{ flex: 1, gap: 22 }}>
                  <ol className="step-list">
                    <li>
                      <span>1</span>สแกน QR หรือกดปุ่ม “เชื่อมต่อ LINE”
                    </li>
                    <li>
                      <span>2</span>อนุญาตและเพิ่มเพื่อน Mahidol Startup Club
                    </li>
                    <li>
                      <span>3</span>กลับมาที่หน้านี้ ระบบจะเชื่อมให้อัตโนมัติ
                    </li>
                  </ol>
                  <div className="row" style={{ marginTop: 'auto', gap: 20, padding: 16, borderRadius: 18, background: 'var(--bg)' }}>
                    <div className="qr-box">
                      {qrSvg ? (
                        <span dangerouslySetInnerHTML={{ __html: qrSvg }} style={{ width: '100%', height: '100%', display: 'block' }} />
                      ) : (
                        <>
                          <IconQr size={28} />
                          QR LINE OA
                        </>
                      )}
                    </div>
                    <div className="stack" style={{ flex: 1, minWidth: 0, gap: 10 }}>
                      <span className="stack" style={{ lineHeight: 1.45 }}>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>สแกนด้วยกล้องมือถือ</span>
                        <span className="muted" style={{ fontSize: 13 }}>
                          หรือถ้าเปิดบนมือถืออยู่ กดปุ่มนี้ได้เลย
                        </span>
                      </span>
                      {lineLoginEnabled() ? (
                        <a href={linkHref} className="btn btn-line" style={{ alignSelf: 'flex-start', minHeight: 50, padding: '0 24px', borderRadius: 14, fontSize: 16 }}>
                          <IconLine size={22} />
                          เชื่อมต่อ LINE
                        </a>
                      ) : (
                        <span className="muted" style={{ fontSize: 13 }}>
                          ผู้ดูแลยังไม่ได้ตั้งค่า LINE Login
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
                ตัวอย่างข้อความที่คุณจะได้รับ
              </span>
              <div className="line-preview">
                <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <span className="msc-dot">MSC</span>
                  <div style={{ flex: 1, minWidth: 0, borderRadius: 18, background: '#fff', overflow: 'hidden', boxShadow: '0 4px 14px -6px rgba(16,35,63,0.2)' }}>
                    <div style={{ padding: '10px 14px', background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 600 }}>มีคนชวนคุณเข้าทีม</div>
                    <div className="stack" style={{ padding: 14, gap: 6 }}>
                      <span className="head" style={{ fontWeight: 500, fontSize: 17, lineHeight: 1.3 }}>
                        ทีม CareLoop
                      </span>
                      <span className="muted" style={{ fontSize: 13 }}>
                        TED Youth Startup 2026 · อยากได้ UX/UI Designer
                      </span>
                      <span style={{ fontSize: 13 }}>“ชอบพอร์ต UX ของคุณมาก อยากชวนมาคุยค่ะ”</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--border)', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
                      <span style={{ padding: '12px 0', color: 'var(--brand)' }}>ดูคำชวน</span>
                      <span style={{ padding: '12px 0', color: 'var(--muted)', borderLeft: '1px solid var(--border)' }}>ไว้ทีหลัง</span>
                    </div>
                  </div>
                </div>
                <span style={{ alignSelf: 'flex-end', fontSize: 11, color: 'var(--muted)' }}>10:42</span>
              </div>
              <span className="row muted" style={{ gap: 8, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.5 }}>
                <IconShield size={16} />
                เราส่งเฉพาะเรื่องที่คุณเลือก ไม่เห็นแชตส่วนตัว และยกเลิกได้ทุกเมื่อ
              </span>
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

          <EmailSection
            email={p.email_is_placeholder ? null : p.email}
            emailNotifications={p.email_notifications}
            canSendEmail={emailEnabled()}
          />

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
