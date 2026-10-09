import Link from 'next/link'
import Image from 'next/image'
import { after } from 'next/server'
import type { Metadata } from 'next'
import Avatar from '@/components/Avatar'
import Crumbs from '@/components/Crumbs'
import ChatPanel from '@/components/ChatPanel'
import { IconBack, IconLine, IconLock } from '@/components/icons'
import { respondAction } from '@/app/actions/messaging'
import { requireViewer } from '@/lib/auth'
import { getConversation, listInbox } from '@/lib/data/inbox'
import { markRead } from '@/lib/messaging'
import { chatTime, dayLabel, deadlineLine } from '@/lib/format'
import { ROLES, type Role } from '@/lib/constants'
import SubmitButton from '@/components/SubmitButton'

export const metadata: Metadata = { title: 'ข้อความ' }
export const dynamic = 'force-dynamic'

export default async function InboxPage({ searchParams }: PageProps<'/inbox'>) {
  const sp = await searchParams
  const viewer = await requireViewer('/inbox')
  const tab = sp.tab === 'requests' ? 'requests' : 'all'
  const convId = typeof sp.c === 'string' && /^[0-9a-f-]{36}$/i.test(sp.c) ? sp.c : null
  const [items, view] = await Promise.all([listInbox(viewer.userId), convId ? getConversation(convId, viewer.userId) : Promise.resolve(null)])
  const shown = tab === 'requests' ? items.filter((i) => i.isRequest) : items
  if (view) after(() => markRead(view.conv.id, viewer.userId))
  const p = viewer.profile
  const lineOn = Boolean(p.line_user_id && p.line_is_friend)

  return (
    <div style={{ background: 'radial-gradient(120% 70% at 100% 0%, rgba(0,53,173,0.10) 0%, rgba(0,53,173,0) 60%), linear-gradient(180deg, #F4F7FC 0%, #E1E9F8 100%)', lineHeight: 1.6 }}>
      <div className="container stack" style={{ paddingTop: 24, paddingBottom: 40, gap: 18 }}>
        <Crumbs back="/" trail={[{ label: 'หน้าแรก', href: '/' }, { label: 'ข้อความ' }]} />
        <div className={`inbox-shell ${view ? 'has-active' : ''}`}>
          <aside className="inbox-list">
            <div className="stack" style={{ padding: '22px 20px 12px', gap: 14 }}>
              <h1 style={{ margin: 0, fontWeight: 600, fontSize: 26 }}>ข้อความ</h1>
              <div role="tablist" className="segmented" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--bg)' }}>
                <Link href={`/inbox?tab=all${convId ? `&c=${convId}` : ''}`} role="tab" aria-selected={tab === 'all'} scroll={false}>
                  ทั้งหมด
                </Link>
                <Link href={`/inbox?tab=requests${convId ? `&c=${convId}` : ''}`} role="tab" aria-selected={tab === 'requests'} scroll={false}>
                  คำชวน &amp; คำขอ
                </Link>
              </div>
            </div>
            <div className="inbox-items">
              {shown.length === 0 && (
                <p className="muted" style={{ padding: '24px 18px', fontSize: 14, textAlign: 'center' }}>
                  {tab === 'requests' ? 'ยังไม่มีคำชวนหรือคำขอ' : 'ยังไม่มีข้อความ — ลองทักคนที่กำลังหาทีมดู'}
                </p>
              )}
              {shown.map((i) => (
                <Link
                  key={i.id}
                  href={`/inbox?tab=${tab}&c=${i.id}`}
                  className={`inbox-item ${i.id === convId ? 'active' : ''} ${i.unread || i.pendingForMe ? 'unread' : ''}`}
                  scroll={false}
                >
                  <Avatar name={i.other.name} initial={i.other.initial} src={i.other.avatar_url} anonymous={i.other.anonymous} size={46} fontSize={17} />
                  <span className="meta">
                    <span className="l1">
                      <span className="nm">
                        {i.other.name}
                        {i.other.anonymous && (
                          <span style={{ display: 'inline-flex', color: 'var(--muted)' }}>
                            <IconLock size={13} />
                          </span>
                        )}
                      </span>
                      <span style={{ flex: 'none', fontSize: 12, color: 'var(--muted)' }}>{chatTime(i.at)}</span>
                    </span>
                    <span className="l2">
                      <span className="pv">{i.preview}</span>
                      {(i.unread || i.pendingForMe) && <span className="unread-dot" />}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
            <Link href="/me#line" className="line-status">
              <span style={{ display: 'inline-flex', color: '#06C755' }}>
                <IconLine size={18} />
              </span>
              <span style={{ flex: 1 }}>
                แจ้งเตือนผ่าน LINE: <strong style={{ fontWeight: 600 }}>{lineOn ? 'เปิดอยู่' : p.line_user_id ? 'ยังไม่ได้เพิ่มเพื่อน' : 'ยังไม่เชื่อม'}</strong>
              </span>
              <span style={{ color: 'var(--brand)', fontWeight: 600 }}>ตั้งค่า</span>
            </Link>
          </aside>

          {view ? (
            <section className="chat">
              <div className="chat-head">
                <Link href={`/inbox?tab=${tab}`} className="sq-btn mobile-back" aria-label="กลับไปรายการข้อความ" style={{ background: 'transparent' }}>
                  <IconBack size={20} />
                </Link>
                <Avatar name={view.other.name} initial={view.other.initial} src={view.other.avatar_url} anonymous={view.other.anonymous} size={44} fontSize={16} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
                  <span style={{ fontWeight: 600, fontSize: 16 }}>{view.other.name}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {view.other.faculty_line}
                  </span>
                </span>
                {view.otherProfileId && (
                  <Link href={`/u/${view.otherProfileId}`} className="btn btn-outline btn-pill btn-sm">
                    ดูโปรไฟล์
                  </Link>
                )}
              </div>
              <ChatPanel
                conversationId={view.conv.id}
                canSend={view.canSend}
                lockedReason={view.lockedReason}
                header={
                  view.conv.request_kind !== 'message' ? (
                    <div className="request-card">
                      {view.team ? (
                        <Link href={view.team.event ? `/opportunities/${view.team.event.slug}` : '/teams?tab=teams'} className="row" style={{ gap: 12, textDecoration: 'none', color: 'var(--navy)' }}>
                          {view.team.event?.poster_url ? (
                            <Image src={view.team.event.poster_url} alt="" width={48} height={60} style={{ flex: 'none', width: 48, height: 60, borderRadius: 10, objectFit: 'cover', objectPosition: 'top' }} />
                          ) : (
                            <span className="team-logo">{Array.from(view.team.name)[0]}</span>
                          )}
                          <span className="stack" style={{ minWidth: 0, lineHeight: 1.4 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>{view.conv.request_kind === 'invite' ? 'คำชวนเข้าทีม' : 'คำขอเข้าร่วมทีม'}</span>
                            <span className="head" style={{ fontWeight: 500, fontSize: 16 }}>
                              ทีม {view.team.name}
                              {view.team.roles_needed[0] ? ` · ตำแหน่ง ${ROLES[view.team.roles_needed[0] as Role]}` : ''}
                            </span>
                            <span className="muted" style={{ fontSize: 12 }}>
                              {view.team.event ? `${view.team.event.title} · ${deadlineLine(view.team.event.deadline)}` : view.team.pitch}
                            </span>
                          </span>
                        </Link>
                      ) : (
                        <span className="stack" style={{ lineHeight: 1.4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>คำขอทำความรู้จัก</span>
                          <span style={{ fontSize: 14 }}>ชื่อจริงของทั้งสองฝ่ายจะแสดงเมื่อตอบรับคำขอแล้ว</span>
                        </span>
                      )}
                      {view.canRespond ? (
                        <form action={respondAction} className="row" style={{ gap: 8 }}>
                          <input type="hidden" name="conversationId" value={view.conv.id} />
                          <SubmitButton name="accept" value="1" className="btn btn-primary" style={{ flex: 1, minHeight: 44, fontSize: 14 }}>
                            {view.conv.request_kind === 'invite' ? 'ตอบรับเข้าทีม' : view.conv.request_kind === 'join' ? 'รับเข้าทีม' : 'ยอมรับ'}
                          </SubmitButton>
                          <SubmitButton name="accept" value="0" className="btn btn-outline" style={{ flex: 1, minHeight: 44, fontSize: 14 }}>
                            ยังไม่ตอนนี้
                          </SubmitButton>
                        </form>
                      ) : (
                        <span className="muted" style={{ fontSize: 13 }}>
                          {view.conv.request_status === 'pending'
                            ? 'รออีกฝ่ายตอบรับ'
                            : view.conv.request_status === 'accepted'
                              ? 'ตอบรับแล้ว ✓'
                              : 'ไม่ได้รับการตอบรับ'}
                        </span>
                      )}
                    </div>
                  ) : null
                }
                messages={view.messages.map((m, idx) => ({
                  ...m,
                  time: chatTime(m.at),
                  day: idx === 0 || dayLabel(view.messages[idx - 1].at) !== dayLabel(m.at) ? dayLabel(m.at) : null,
                }))}
              />
            </section>
          ) : (
            <section className="chat" style={{ alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
              <span className="muted">เลือกบทสนทนาทางซ้ายเพื่อเริ่มคุย</span>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
