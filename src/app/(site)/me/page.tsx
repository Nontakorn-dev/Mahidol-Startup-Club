import Link from 'next/link'
import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import ProfileForm from '@/components/forms/ProfileForm'
import LineLinkCard from '@/components/LineLinkCard'
import { EmptyState, EventCard } from '@/components/Cards'
import { setPostStatus } from '@/app/actions/posts'
import { requireViewer } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { listPublishedEvents } from '@/lib/data/events'
import { shortName } from '@/lib/format'
import { ROLES, STAGES, TRACK_SEEK_LABEL, type Role, type Stage, type Track } from '@/lib/constants'

export const metadata: Metadata = { title: 'โปรไฟล์ของฉัน' }
export const dynamic = 'force-dynamic'

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'ออนไลน์', cls: 'tag-ok' },
  draft: { label: 'ฉบับร่าง', cls: 'tag-yellow' },
  closed: { label: 'ปิดแล้ว', cls: 'tag-grey' },
  removed: { label: 'ถูกลบโดยแอดมิน', cls: 'tag-grey' },
}

function PostRow({ type, id, title, sub, status, editHref, anonymous }: { type: 'team' | 'seeker' | 'cofounder'; id: string; title: string; sub: string; status: string; editHref: string; anonymous: boolean }) {
  const s = STATUS[status] ?? STATUS.open
  return (
    <div className="row wrap" style={{ gap: 12, padding: '14px 0', borderTop: '1px solid var(--border)' }}>
      <span className="stack" style={{ flex: '1 1 260px', minWidth: 0, lineHeight: 1.4 }}>
        <span className="row wrap" style={{ gap: 8, fontWeight: 600 }}>
          {title}
          <span className={`tag tag-sm ${s.cls}`}>{s.label}</span>
          {anonymous && <span className="tag tag-sm tag-grey">ไม่ระบุชื่อ</span>}
        </span>
        <span className="muted" style={{ fontSize: 13 }}>
          {sub}
        </span>
      </span>
      {status !== 'removed' && (
        <span className="row" style={{ gap: 6 }}>
          <Link href={editHref} className="btn btn-outline btn-sm">
            แก้ไข
          </Link>
          <form action={setPostStatus}>
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={status === 'open' ? 'closed' : 'open'} />
            <button type="submit" className="btn btn-outline btn-sm">
              {status === 'open' ? 'ปิดประกาศ' : 'เปิดอีกครั้ง'}
            </button>
          </form>
          <form action={setPostStatus}>
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="delete" />
            <button type="submit" className="btn btn-danger btn-sm">
              ลบ
            </button>
          </form>
        </span>
      )}
    </div>
  )
}

export default async function MePage({ searchParams }: PageProps<'/me'>) {
  const sp = await searchParams
  const tab = sp.tab === 'posts' || sp.tab === 'saved' ? sp.tab : sp.saved === 'draft' ? 'posts' : 'profile'
  const viewer = await requireViewer('/me')
  const p = viewer.profile
  const db = adminClient()

  const tabs = [
    { key: 'profile', label: 'โปรไฟล์' },
    { key: 'posts', label: 'ประกาศของฉัน' },
    { key: 'saved', label: 'งานที่บันทึก' },
  ]

  let body: React.ReactNode = null
  if (tab === 'profile') {
    body = (
      <div className="stack" style={{ gap: 20 }}>
        <section id="line" className="card stack" style={{ padding: 24, gap: 14 }}>
          <h2 style={{ margin: 0, fontWeight: 500, fontSize: 20 }}>🔗 เชื่อมต่อ LINE</h2>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            ผูกบัญชีอีเมลนี้กับ LINE เพื่อรับข่าวสาร คำชวนเข้าทีม และงานแข่งที่ตรงกับคุณผ่าน LINE OA — ถ้าไม่เชื่อมจะได้รับทางอีเมลแทน
          </p>
          <LineLinkCard p={p} next="/me" compact />
        </section>
        <ProfileForm p={p} />
      </div>
    )
  } else if (tab === 'posts') {
    const [{ data: teams }, { data: seekers }, { data: cof }] = await Promise.all([
      db.from('team_posts').select('*, event:events(title)').eq('owner_id', viewer.userId).order('created_at', { ascending: false }),
      db.from('seeker_posts').select('*, event:events(title)').eq('owner_id', viewer.userId).order('created_at', { ascending: false }),
      db.from('cofounder_posts').select('*').eq('owner_id', viewer.userId).order('created_at', { ascending: false }),
    ])
    const total = (teams?.length || 0) + (seekers?.length || 0) + (cof?.length || 0)
    body = (
      <div className="stack" style={{ gap: 20 }}>
        {sp.saved === 'draft' && <div className="alert alert-ok">บันทึกร่างแล้ว — กลับมาแก้แล้วเผยแพร่ได้ทุกเมื่อ</div>}
        <div className="row wrap" style={{ gap: 10 }}>
          <Link href="/teams/new" className="btn btn-outline">
            + ชวนคนเข้าทีม
          </Link>
          <Link href="/teams/looking/new" className="btn btn-outline">
            + ประกาศหาทีม
          </Link>
          <Link href="/cofounder/new" className="btn btn-outline">
            {cof?.length ? 'แก้ไขโปรไฟล์ Co-founder' : '+ โปรไฟล์ Co-founder'}
          </Link>
        </div>
        {total === 0 ? (
          <EmptyState title="ยังไม่มีประกาศ" body="ประกาศชวนคนเข้าทีม บอกว่ากำลังหาทีม หรือสร้างโปรไฟล์ Co-founder ได้จากปุ่มด้านบน" />
        ) : (
          <section className="panel" style={{ gap: 0 }}>
            {(teams || []).map((t) => (
              <PostRow
                key={t.id}
                type="team"
                id={t.id}
                title={`ทีม ${t.name}`}
                sub={`${t.event?.title ?? t.event_note ?? 'ยังไม่ระบุงาน'} · มองหา ${(t.roles_needed as Role[]).map((r) => ROLES[r]).join(', ')} · สมาชิก ${t.members_count}/${t.target_size}`}
                status={t.status}
                editHref={`/teams/${t.id}/edit`}
                anonymous={t.is_anonymous}
              />
            ))}
            {(seekers || []).map((s) => (
              <PostRow
                key={s.id}
                type="seeker"
                id={s.id}
                title={`หาทีม: ${s.looking_text}`}
                sub={s.event?.title ?? 'งานไหนก็ได้'}
                status={s.status}
                editHref={`/teams/looking/${s.id}/edit`}
                anonymous={s.is_anonymous}
              />
            ))}
            {(cof || []).map((c) => (
              <PostRow
                key={c.id}
                type="cofounder"
                id={c.id}
                title={`Co-founder: ${c.idea_title ?? '—'}`}
                sub={`${STAGES[c.stage as Stage]} · มองหา ${(c.seeking as Track[]).map((t) => TRACK_SEEK_LABEL[t]).join(', ')}`}
                status={c.status}
                editHref="/cofounder/new"
                anonymous={c.is_anonymous}
              />
            ))}
          </section>
        )}
      </div>
    )
  } else {
    const { data: saved } = await db.from('saved_events').select('event_id').eq('user_id', viewer.userId)
    const events = await listPublishedEvents({ ids: (saved || []).map((s) => s.event_id) })
    body = events.length ? (
      <div className="stack" style={{ gap: 14 }}>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          เราจะเตือนก่อนปิดรับ 3 วัน{p.notify_reminders ? '' : ' (ตอนนี้ปิดการเตือนอยู่ — เปิดได้ในหน้าตั้งค่าการแจ้งเตือน)'}
        </p>
        <div className="grid-events">
          {events.map((e) => (
            <EventCard key={e.id} e={e} />
          ))}
        </div>
      </div>
    ) : (
      <EmptyState title="ยังไม่ได้บันทึกงานไหน" body="กด “บันทึก” ในหน้ารายละเอียดงาน แล้วเราจะเตือนก่อนปิดรับ" action={<Link href="/opportunities" className="btn btn-primary btn-pill">ดูงานแข่ง &amp; ทุน</Link>} />
    )
  }

  return (
    <div className="bg-soft">
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px 96px' }} className="stack">
        <div className="stack" style={{ gap: 12, marginBottom: 24 }}>
          <Crumbs back="/" trail={[{ label: 'หน้าแรก', href: '/' }, { label: 'โปรไฟล์ของฉัน' }]} />
          <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
            <h1 style={{ margin: 0, fontWeight: 600, fontSize: 36 }}>{shortName(p.first_name, p.last_name)}</h1>
            <span className="row wrap" style={{ gap: 8 }}>
              <Link href={`/u/${p.id}`} className="btn btn-outline btn-sm">
                ดูโปรไฟล์สาธารณะ
              </Link>
              <Link href="/settings/notifications" className="btn btn-outline btn-sm">
                ตั้งค่าแจ้งเตือน / LINE
              </Link>
            </span>
          </div>
          <div role="tablist" className="segmented" style={{ alignSelf: 'flex-start' }}>
            {tabs.map((t) => (
              <Link key={t.key} href={`/me?tab=${t.key}`} role="tab" aria-selected={tab === t.key} scroll={false}>
                {t.label}
              </Link>
            ))}
          </div>
        </div>
        {body}
      </div>
    </div>
  )
}
