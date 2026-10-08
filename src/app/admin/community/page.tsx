import Link from 'next/link'
import { after } from 'next/server'
import type { Metadata } from 'next'
import { moderatePost } from '@/app/actions/admin'
import { IconEye, IconLock, IconVerified } from '@/components/icons'
import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { adminTime, shortName } from '@/lib/format'
import { ROLES, TRACK_SEEK_LABEL, type Role, type Track } from '@/lib/constants'
import SubmitButton from '@/components/SubmitButton'

export const metadata: Metadata = { title: 'ทีม & โปรไฟล์' }
export const dynamic = 'force-dynamic'

const COLS = '2.4fr 1.3fr 0.9fr 1fr 1fr'
type Owner = { first_name: string; last_name: string; is_verified: boolean } | null

export default async function AdminCommunityPage({ searchParams }: PageProps<'/admin/community'>) {
  const admin = await requireAdmin()
  const sp = await searchParams
  const tab = sp.tab === 'seeker' || sp.tab === 'cofounder' ? sp.tab : 'team'
  const since = admin.profile.admin_last_seen_at ?? new Date(0).toISOString()
  after(async () => {
    await adminClient().from('profiles').update({ admin_last_seen_at: new Date().toISOString() }).eq('id', admin.userId)
  })
  const db = adminClient()
  const ownerSel = 'owner:profiles(first_name, last_name, is_verified)'
  const [teams, seekers, cofs] = await Promise.all([
    db.from('team_posts').select(`id, name, pitch, roles_needed, is_anonymous, status, created_at, event:events(title, slug), ${ownerSel}`).order('created_at', { ascending: false }).limit(200),
    db.from('seeker_posts').select(`id, looking_text, skills, is_anonymous, status, created_at, event:events(title, slug), ${ownerSel}`).order('created_at', { ascending: false }).limit(200),
    db.from('cofounder_posts').select(`id, idea_title, seeking, is_anonymous, status, created_at, ${ownerSel}`).order('created_at', { ascending: false }).limit(200),
  ])
  type Row = { id: string; title: string; sub: string; anon: boolean; owner: Owner; status: string; created_at: string; view: string }
  const rows: Record<string, Row[]> = {
    team: (teams.data || []).map((t) => {
      const ev = t.event as unknown as { title: string; slug: string } | null
      return {
        id: t.id,
        title: `${t.name} · ชวนคนเข้าทีม`,
        sub: `${ev?.title ?? 'ไม่ได้ระบุงาน'} · มองหา ${(t.roles_needed as Role[]).map((r) => ROLES[r]).join(', ')} · “${t.pitch}”`,
        anon: t.is_anonymous,
        owner: t.owner as unknown as Owner,
        status: t.status,
        created_at: t.created_at,
        view: ev ? `/opportunities/${ev.slug}#teams` : '/teams?tab=teams',
      }
    }),
    seeker: (seekers.data || []).map((s) => {
      const ev = s.event as unknown as { title: string } | null
      return {
        id: s.id,
        title: `หาทีม: ${s.looking_text}`,
        sub: `${ev?.title ?? 'งานไหนก็ได้'} · ${(s.skills as string[]).join(', ')}`,
        anon: s.is_anonymous,
        owner: s.owner as unknown as Owner,
        status: s.status,
        created_at: s.created_at,
        view: '/teams?tab=people',
      }
    }),
    cofounder: (cofs.data || []).map((c) => ({
      id: c.id,
      title: `Co-founder: ${c.idea_title ?? '—'}`,
      sub: `มองหา ${(c.seeking as Track[]).map((t) => TRACK_SEEK_LABEL[t]).join(', ')}`,
      anon: c.is_anonymous,
      owner: c.owner as unknown as Owner,
      status: c.status,
      created_at: c.created_at,
      view: '/cofounder',
    })),
  }
  const live = (r: Row[]) => r.filter((x) => x.status !== 'removed').length
  const tabs = [
    { key: 'team', label: 'ประกาศชวนคนเข้าทีม', n: live(rows.team) },
    { key: 'seeker', label: 'คนหาทีม', n: live(rows.seeker) },
    { key: 'cofounder', label: 'โปรไฟล์ Co-founder', n: live(rows.cofounder) },
  ]
  const STATUS: Record<string, [string, string]> = {
    open: ['ออนไลน์', 'tag-ok'],
    draft: ['ฉบับร่าง', 'tag-yellow'],
    closed: ['ปิดแล้ว', 'tag-grey'],
    removed: ['ลบแล้ว', 'tag-grey'],
  }

  return (
    <>
      <div>
        <h1>ทีม &amp; โปรไฟล์</h1>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 15 }}>
          ผู้ใช้โพสต์แล้วขึ้นเว็บทันที ไม่ต้องรออนุมัติ — แอดมินคอยดู และลบได้ถ้าเนื้อหาไม่เหมาะสม
        </p>
      </div>
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
        <div role="tablist" className="segmented" style={{ flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <Link key={t.key} href={`/admin/community?tab=${t.key}`} role="tab" aria-selected={tab === t.key}>
              {t.label} <span className="n">{t.n}</span>
            </Link>
          ))}
        </div>
        <span className="row muted" style={{ gap: 8, fontSize: 13 }}>
          <span style={{ display: 'inline-flex', color: 'var(--navy-2)' }}>
            <IconLock size={14} />
          </span>
          โพสต์ไม่ระบุชื่อ: แอดมินก็ไม่เห็นชื่อเจ้าของ แต่ลบได้ตามปกติ
        </span>
      </div>
      <div className="table">
        <div style={{ minWidth: 860 }}>
          <div className="tr th" style={{ gridTemplateColumns: COLS }}>
            <span>โพสต์</span>
            <span>เจ้าของ</span>
            <span>วันที่</span>
            <span>สถานะ</span>
            <span style={{ textAlign: 'right' }}>จัดการ</span>
          </div>
          {rows[tab].length === 0 && (
            <p className="muted" style={{ padding: 24, margin: 0 }}>
              ยังไม่มีโพสต์
            </p>
          )}
          {rows[tab].map((r) => (
            <div key={r.id} className="tr" style={{ gridTemplateColumns: COLS, opacity: r.status === 'removed' ? 0.55 : 1 }}>
              <span className="stack" style={{ minWidth: 0, lineHeight: 1.4 }}>
                <span className="row" style={{ gap: 8, fontWeight: 600, fontSize: 15 }}>
                  {r.title}
                  {r.created_at > since && <span className="tag tag-yellow" style={{ padding: '0 8px', fontSize: 11 }}>ใหม่</span>}
                </span>
                <span className="muted" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.sub}
                </span>
              </span>
              <span className="row" style={{ gap: 6 }}>
                {r.anon ? 'ไม่ระบุชื่อ' : shortName(r.owner?.first_name, r.owner?.last_name)}
                {!r.anon && r.owner?.is_verified && (
                  <span title="Mahidol verified" style={{ display: 'inline-flex', color: 'var(--brand)' }}>
                    <IconVerified size={16} />
                  </span>
                )}
              </span>
              <span className="muted">{adminTime(r.created_at)}</span>
              <span>
                <span className={`tag tag-sm ${STATUS[r.status]?.[1]}`} style={{ fontSize: 13 }}>
                  {STATUS[r.status]?.[0] ?? r.status}
                </span>
              </span>
              <span className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                <Link href={r.view} aria-label="ดูโพสต์" className="sq-btn" target="_blank">
                  <IconEye size={18} />
                </Link>
                <form action={moderatePost}>
                  <input type="hidden" name="type" value={tab} />
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="action" value={r.status === 'removed' ? 'restore' : 'remove'} />
                  <SubmitButton className={r.status === 'removed' ? 'btn btn-outline btn-sm' : 'btn btn-danger btn-sm'}>
                    {r.status === 'removed' ? 'กู้คืน' : 'ลบ'}
                  </SubmitButton>
                </form>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
