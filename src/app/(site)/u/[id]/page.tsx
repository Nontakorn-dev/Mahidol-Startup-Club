import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Avatar from '@/components/Avatar'
import Crumbs from '@/components/Crumbs'
import ContactButton from '@/components/ContactButton'
import { IconChatSimple, IconCheck, IconEdit, IconLink, IconLock, IconUserPlus } from '@/components/icons'
import { getViewer } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { initialOf, shortName } from '@/lib/format'
import { ROLES, type Role } from '@/lib/constants'
import type { Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function loadProfile(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await adminClient().from('profiles').select('*').eq('id', id).maybeSingle()
  return (data as Profile | null) && !data.is_suspended ? (data as Profile) : null
}

export async function generateMetadata({ params }: PageProps<'/u/[id]'>): Promise<Metadata> {
  const { id } = await params
  const p = await loadProfile(id)
  return { title: p ? shortName(p.first_name, p.last_name) : 'ไม่พบโปรไฟล์' }
}

export default async function PublicProfilePage({ params }: PageProps<'/u/[id]'>) {
  const { id } = await params
  const p = await loadProfile(id)
  if (!p) notFound()
  const viewer = await getViewer()
  const isMe = viewer?.userId === p.id
  const db = adminClient()
  // Only non-anonymous posts may be tied to a named profile.
  const [{ data: teams }, { data: seeker }, { data: myTeams }] = await Promise.all([
    db
      .from('team_posts')
      .select('id, name, pitch, roles_needed, event:events(slug, title, poster_url)')
      .eq('owner_id', p.id)
      .eq('status', 'open')
      .eq('is_anonymous', false)
      .order('created_at', { ascending: false }),
    db
      .from('seeker_posts')
      .select('looking_text, event:events(slug, title)')
      .eq('owner_id', p.id)
      .eq('status', 'open')
      .eq('is_anonymous', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    viewer ? db.from('team_posts').select('id, name').eq('owner_id', viewer.userId).eq('status', 'open') : Promise.resolve({ data: [] }),
  ])
  const name = shortName(p.first_name, p.last_name)
  const looking = seeker as unknown as { looking_text: string; event: { slug: string; title: string } | null } | null
  const teamRows = (teams || []) as unknown as {
    id: string
    name: string
    pitch: string
    roles_needed: Role[]
    event: { slug: string; title: string; poster_url: string | null } | null
  }[]
  const meta = [p.faculty && `คณะ ${p.faculty}`, p.year, p.campus && `วิทยาเขต${p.campus}`].filter(Boolean).join(' · ')

  return (
    <div className="bg-soft" style={{ lineHeight: 1.65 }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 20px 96px' }} className="stack">
        <div style={{ marginBottom: 24 }}>
          <Crumbs back="/teams" trail={[{ label: 'หาทีม', href: '/teams' }, { label: name }]} />
        </div>
        <section className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
          <div className="profile-cover" />
          <div className="profile-top">
            <Avatar name={name} initial={initialOf(p.first_name)} src={p.avatar_url} size={128} className="profile-avatar" fontSize={46} />
            <div className="stack" style={{ flex: '1 1 360px', minWidth: 0, gap: 6, paddingTop: 18 }}>
              <div className="row wrap" style={{ gap: 10 }}>
                <h1 style={{ margin: 0, fontWeight: 600, fontSize: 30, lineHeight: 1.2 }}>{name}</h1>
                {p.is_verified && (
                  <span className="verified">
                    <span className="dot">
                      <IconCheck size={12} />
                    </span>
                    Mahidol verified
                  </span>
                )}
              </div>
              {p.headline && <span style={{ fontSize: 17 }}>{p.headline}</span>}
              {meta && (
                <span className="muted" style={{ fontSize: 14 }}>
                  {meta}
                </span>
              )}
              {looking && (
                <Link href={looking.event ? `/opportunities/${looking.event.slug}` : '/teams'} className="looking-pill">
                  <span className="dot" />
                  กำลังมองหาทีม · {looking.event?.title ?? looking.looking_text}
                </Link>
              )}
            </div>
            <div className="row wrap" style={{ gap: 10, paddingBottom: 4 }}>
              {isMe ? (
                <Link href="/me" className="btn btn-primary btn-pill">
                  <IconEdit size={18} /> แก้ไขโปรไฟล์
                </Link>
              ) : (
                <>
                  <ContactButton targetType="profile" targetId={p.id} kind="message" label="ส่งข้อความ" targetName={name} loggedIn={Boolean(viewer)} icon={<IconChatSimple size={18} />} />
                  <ContactButton
                    targetType="profile"
                    targetId={p.id}
                    kind="invite"
                    label="ชวนเข้าทีม"
                    variant="outline"
                    targetName={name}
                    loggedIn={Boolean(viewer)}
                    myTeams={myTeams || []}
                    icon={<IconUserPlus size={18} />}
                  />
                </>
              )}
            </div>
          </div>
        </section>

        <div className="profile-grid">
          <div className="stack" style={{ gap: 24 }}>
            <section className="panel">
              <h2>เกี่ยวกับฉัน</h2>
              <p style={{ margin: 0, fontSize: 16, whiteSpace: 'pre-line' }}>{p.bio || <span className="muted">ยังไม่ได้เขียนแนะนำตัว</span>}</p>
            </section>

            {teamRows.length > 0 && (
              <section className="panel tinted">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h2>ประกาศที่เปิดอยู่</h2>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {teamRows.length} ประกาศ
                  </span>
                </div>
                {teamRows.map((t) => (
                  <Link
                    key={t.id}
                    href={t.event ? `/opportunities/${t.event.slug}#teams` : '/teams?tab=team'}
                    className="row"
                    style={{ gap: 18, padding: 16, borderRadius: 18, background: '#fff', boxShadow: 'var(--shadow-soft)', textDecoration: 'none', color: 'var(--navy)' }}
                  >
                    {t.event?.poster_url ? (
                      <Image src={t.event.poster_url} alt="" width={76} height={96} style={{ flex: 'none', width: 76, height: 96, borderRadius: 12, objectFit: 'cover', objectPosition: 'top' }} />
                    ) : (
                      <span className="team-logo" style={{ width: 76, height: 96, borderRadius: 12, fontSize: 28 }}>
                        {Array.from(t.name)[0]}
                      </span>
                    )}
                    <span className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>ชวนคนเข้าทีม</span>
                      <span className="head" style={{ fontWeight: 500, fontSize: 18, lineHeight: 1.3 }}>
                        {t.event ? `ทีม ${t.name} · ${t.event.title}` : `ทีม ${t.name}`}
                      </span>
                      <span className="row wrap muted" style={{ gap: 6, fontSize: 13 }}>
                        กำลังมองหา
                        {t.roles_needed.map((r) => (
                          <span key={r} className="tag tag-yellow tag-sm">
                            {ROLES[r]}
                          </span>
                        ))}
                      </span>
                    </span>
                  </Link>
                ))}
              </section>
            )}

            {p.experiences.length > 0 && (
              <section className="panel" style={{ gap: 18 }}>
                <h2>ผลงาน &amp; ประสบการณ์</h2>
                {p.experiences.map((x, i) => (
                  <div key={i} className="exp-item">
                    <span className="exp-ic">{initialOf(x.title)}</span>
                    <span className="stack" style={{ minWidth: 0, gap: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 16 }}>{x.title}</span>
                      {x.subtitle && (
                        <span className="muted" style={{ fontSize: 13 }}>
                          {x.subtitle}
                        </span>
                      )}
                      {x.description && <span style={{ fontSize: 15 }}>{x.description}</span>}
                    </span>
                  </div>
                ))}
              </section>
            )}
          </div>

          <aside className="stack" style={{ gap: 24 }}>
            {p.skills.length > 0 && (
              <section className="panel side">
                <h2>ทักษะ</h2>
                <div className="row wrap" style={{ gap: 8 }}>
                  {p.skills.map((s, i) => (
                    <span key={s} className={`skill-tag ${i < 3 ? 'primary' : ''}`}>
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {(p.availability || p.work_mode || p.start_when) && (
              <section className="panel side">
                <h2>ความพร้อม</h2>
                <dl className="kv">
                  {p.availability && (
                    <>
                      <dt>เวลาว่าง</dt>
                      <dd>{p.availability}</dd>
                    </>
                  )}
                  {p.work_mode && (
                    <>
                      <dt>รูปแบบ</dt>
                      <dd>{p.work_mode}</dd>
                    </>
                  )}
                  {p.start_when && (
                    <>
                      <dt>เริ่มได้</dt>
                      <dd>{p.start_when}</dd>
                    </>
                  )}
                </dl>
              </section>
            )}
            <section className="panel side" style={{ gap: 10 }}>
              <h2>ลิงก์</h2>
              {p.links.length === 0 && <span className="muted" style={{ fontSize: 14 }}>—</span>}
              {p.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener nofollow" className="link-row">
                  <span className="ic">
                    <IconLink size={16} />
                  </span>
                  <span className="stack" style={{ lineHeight: 1.3 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{l.label}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {l.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}
                    </span>
                  </span>
                </a>
              ))}
              <span className="row muted" style={{ marginTop: 4, gap: 8, fontSize: 12, alignItems: 'flex-start' }}>
                <span style={{ display: 'inline-flex', marginTop: 2, color: 'var(--navy-2)' }}>
                  <IconLock size={14} />
                </span>
                อีเมลและ LINE จะแสดงเมื่อตอบรับกันแล้วเท่านั้น
              </span>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
