import Link from 'next/link'
import Image from 'next/image'
import { after } from 'next/server'
import type { Metadata } from 'next'
import Avatar from '@/components/Avatar'
import Crumbs from '@/components/Crumbs'
import ChatPanel from '@/components/ChatPanel'
import { IconBack, IconLine, IconLock } from '@/components/icons'
import { respondAction } from '@/app/actions/messaging'
import { getViewer, requireViewer } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { inferRoles, recommendEventsForRoles, toPublicAuthor } from '@/lib/data/community'
import { listPublishedEvents } from '@/lib/data/events'
import { findConversationWithProfile, getConversation, listInbox } from '@/lib/data/inbox'
import { markRead } from '@/lib/messaging'
import { chatTime, dayLabel, deadlineLine, isClosed } from '@/lib/format'
import { ROLES, type Role } from '@/lib/constants'
import type { Profile, PublicAuthor, RecommendedEvent } from '@/lib/types'
import SubmitButton from '@/components/SubmitButton'

export const metadata: Metadata = { title: 'ข้อความ' }
export const dynamic = 'force-dynamic'

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function InboxPage({ searchParams }: PageProps<'/inbox'>) {
  const sp = await searchParams
  const toId = typeof sp.to === 'string' && UUID_RX.test(sp.to) ? sp.to : null
  const rawConvId = typeof sp.c === 'string' && UUID_RX.test(sp.c) ? sp.c : null

  // Allow direct navigation from "แชท" (`?to=<id>`) even before login so users can preview & draft invites in the real chat UI
  const viewer = toId ? await getViewer() : await requireViewer('/inbox')
  const tab = sp.tab === 'requests' ? 'requests' : 'all'

  // If `?to=<id>` is passed and viewer is logged in, check if a conversation already exists with that member
  let convId = rawConvId
  if (!convId && toId && viewer && viewer.userId !== toId) {
    convId = await findConversationWithProfile(viewer.userId, toId)
  }

  const [items, view, allEvents] = await Promise.all([
    viewer ? listInbox(viewer.userId) : Promise.resolve([]),
    convId && viewer ? getConversation(convId, viewer.userId) : Promise.resolve(null),
    listPublishedEvents(),
  ])

  const openEvents = allEvents.filter((e) => !isClosed(e))

  // Load target profile for `?to=<id>` or for the active conversation's partner so we can recommend competitions
  type PartnerProfile = Pick<
    Profile,
    'id' | 'first_name' | 'last_name' | 'faculty' | 'year' | 'avatar_url' | 'line_picture_url' | 'headline' | 'skills' | 'interests' | 'is_verified'
  >
  const partnerProfileId = view?.otherProfileId ?? toId
  let partnerProfile: PartnerProfile | null = null
  if (partnerProfileId) {
    const { data } = await adminClient()
      .from('profiles')
      .select('id, first_name, last_name, faculty, year, avatar_url, line_picture_url, headline, skills, interests, is_verified')
      .eq('id', partnerProfileId)
      .maybeSingle()
    if (data) partnerProfile = data as PartnerProfile
  }

  let recommendedEvents: RecommendedEvent[] = []
  let partnerRoleLine: string | null = null
  let draftOther: PublicAuthor | null = null

  if (partnerProfile) {
    const roles = inferRoles(partnerProfile)
    const skills = (partnerProfile.skills || []).map((k) => ROLES[k as Role] ?? k)
    recommendedEvents = recommendEventsForRoles(roles, skills, openEvents, Math.max(openEvents.length, 50))
    const primaryRole = partnerProfile.headline?.split(/[·|•—]/)[0].trim() || skills[0] || (roles[0] ? ROLES[roles[0]] : '') || 'สมาชิกชมรม'
    partnerRoleLine = [primaryRole, partnerProfile.faculty, partnerProfile.year].filter(Boolean).join(' · ')
    draftOther = toPublicAuthor(
      {
        ...partnerProfile,
        avatar_url: partnerProfile.avatar_url || partnerProfile.line_picture_url,
      },
      false,
    )
  }

  const shown = tab === 'requests' ? items.filter((i) => i.isRequest) : items
  if (view && viewer) after(() => markRead(view.conv.id, viewer.userId))
  const p = viewer?.profile
  const lineOn = Boolean(p?.line_user_id && p?.line_is_friend)

  const activeOther = view?.other ?? draftOther
  const activeProfileId = view?.otherProfileId ?? partnerProfile?.id ?? null
  const hasActiveChat = Boolean(view || draftOther)
  const isDraftNotInList = Boolean(!view && draftOther && activeProfileId && !shown.some((i) => i.other.id === activeProfileId))

  return (
    <div style={{ background: 'radial-gradient(120% 70% at 100% 0%, rgba(0,53,173,0.10) 0%, rgba(0,53,173,0) 60%), linear-gradient(180deg, #F4F7FC 0%, #E1E9F8 100%)', lineHeight: 1.6 }}>
      <div className="container stack" style={{ paddingTop: 24, paddingBottom: 40, gap: 18 }}>
        <Crumbs back="/" trail={[{ label: 'หน้าแรก', href: '/' }, { label: 'ข้อความ' }]} />
        <div className={`inbox-shell ${hasActiveChat ? 'has-active' : ''}`}>
          <aside className="inbox-list">
            <div className="stack" style={{ padding: '22px 20px 12px', gap: 14 }}>
              <h1 style={{ margin: 0, fontWeight: 600, fontSize: 26 }}>ข้อความ</h1>
              <div role="tablist" className="segmented" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--bg)' }}>
                <Link href={`/inbox?tab=all${convId ? `&c=${convId}` : toId ? `&to=${toId}` : ''}`} role="tab" aria-selected={tab === 'all'} scroll={false}>
                  ทั้งหมด
                </Link>
                <Link href={`/inbox?tab=requests${convId ? `&c=${convId}` : toId ? `&to=${toId}` : ''}`} role="tab" aria-selected={tab === 'requests'} scroll={false}>
                  คำชวน &amp; คำขอ
                </Link>
              </div>
            </div>
            <div className="inbox-items">
              {isDraftNotInList && draftOther && activeProfileId && (
                <Link
                  href={`/inbox?tab=${tab}&to=${activeProfileId}`}
                  className="inbox-item active"
                  scroll={false}
                >
                  <Avatar name={draftOther.name} initial={draftOther.initial} src={draftOther.avatar_url} size={46} fontSize={17} />
                  <span className="meta">
                    <span className="l1">
                      <span className="nm">{draftOther.name}</span>
                      <span style={{ flex: 'none', fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>แชทใหม่</span>
                    </span>
                    <span className="l2">
                      <span className="pv">{partnerRoleLine || draftOther.faculty_line || 'เลือกงานแข่งเพื่อเริ่มชวนคุย'}</span>
                    </span>
                  </span>
                </Link>
              )}
              {shown.length === 0 && !isDraftNotInList && (
                <p className="muted" style={{ padding: '24px 18px', fontSize: 14, textAlign: 'center' }}>
                  {tab === 'requests' ? 'ยังไม่มีคำชวนหรือคำขอ' : 'ยังไม่มีข้อความ — ลองทักคนที่กำลังหาทีมดู'}
                </p>
              )}
              {shown.map((i) => (
                <Link
                  key={i.id}
                  href={`/inbox?tab=${tab}&c=${i.id}`}
                  className={`inbox-item ${i.id === view?.conv.id ? 'active' : ''} ${i.unread || i.pendingForMe ? 'unread' : ''}`}
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
            <Link href={viewer ? '/me#line' : '/login?next=%2Finbox'} className="line-status">
              <span style={{ display: 'inline-flex', color: '#06C755' }}>
                <IconLine size={18} />
              </span>
              <span style={{ flex: 1 }}>
                แจ้งเตือนผ่าน LINE: <strong style={{ fontWeight: 600 }}>{lineOn ? 'เปิดอยู่' : p?.line_user_id ? 'ยังไม่ได้เพิ่มเพื่อน' : 'ยังไม่เชื่อม'}</strong>
              </span>
              <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{viewer ? 'ตั้งค่า' : 'เข้าสู่ระบบ'}</span>
            </Link>
          </aside>

          {hasActiveChat && activeOther ? (
            <section className="chat">
              <div className="chat-head">
                <Link href={`/inbox?tab=${tab}`} className="sq-btn mobile-back" aria-label="กลับไปรายการข้อความ" style={{ background: 'transparent' }}>
                  <IconBack size={20} />
                </Link>
                <Avatar name={activeOther.name} initial={activeOther.initial} src={activeOther.avatar_url} anonymous={activeOther.anonymous} size={44} fontSize={16} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
                  <span style={{ fontWeight: 600, fontSize: 16 }}>{activeOther.name}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {partnerRoleLine || activeOther.faculty_line}
                  </span>
                </span>
                {activeProfileId && (
                  <Link href={`/u/${activeProfileId}`} className="btn btn-outline btn-pill btn-sm">
                    ดูโปรไฟล์
                  </Link>
                )}
              </div>
              <ChatPanel
                conversationId={view?.conv.id ?? null}
                targetProfileId={activeProfileId}
                targetName={activeOther.name}
                targetRole={partnerRoleLine || activeOther.faculty_line}
                recommendedEvents={recommendedEvents}
                loggedIn={Boolean(viewer)}
                canSend={view ? view.canSend : true}
                lockedReason={view ? view.lockedReason : null}
                header={
                  view && view.conv.request_kind !== 'message' ? (
                    <div className="request-card">
                      {view.team ? (
                        <Link href={view.team.event ? `/opportunities/${view.team.event.slug}` : '/teams?tab=team'} className="row" style={{ gap: 12, textDecoration: 'none', color: 'var(--navy)' }}>
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
                messages={
                  view
                    ? view.messages.map((m, idx) => ({
                        ...m,
                        time: chatTime(m.at),
                        day: idx === 0 || dayLabel(view.messages[idx - 1].at) !== dayLabel(m.at) ? dayLabel(m.at) : null,
                      }))
                    : []
                }
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
