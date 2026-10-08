import Link from 'next/link'
import { IconChevronRight, IconPlus } from '@/components/icons'
import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { adminTime, formatNumber, isClosed, shortName, thaiLongToday, todayBangkok } from '@/lib/format'

export const dynamic = 'force-dynamic'

const weekAgo = () => new Date(Date.now() - 7 * 86_400_000).toISOString()
const startOfTodayBkk = () => new Date(`${todayBangkok()}T00:00:00+07:00`).toISOString()

export default async function AdminDashboard() {
  const admin = await requireAdmin()
  const db = adminClient()
  const since = admin.profile.admin_last_seen_at ?? weekAgo()
  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count || 0)

  const [users, usersWeek, lineLinked, events, teamsOpen, teamsWeek, metrics, logs, recentTeams, recentSeekers, recentCof, ...newToday] = await Promise.all([
    count(db.from('profiles').select('id', { count: 'exact', head: true })),
    count(db.from('profiles').select('id', { count: 'exact', head: true }).gt('created_at', weekAgo())),
    count(db.from('profiles').select('id', { count: 'exact', head: true }).not('line_user_id', 'is', null)),
    db.from('events').select('id, title, slug, status, deadline, deadline_at, is_club, featured').then((r) => r.data || []),
    count(db.from('team_posts').select('id', { count: 'exact', head: true }).eq('status', 'open')),
    count(db.from('team_posts').select('id', { count: 'exact', head: true }).gt('created_at', weekAgo())),
    db.from('event_metrics').select('event_id, kind').gt('created_at', weekAgo()).limit(20000).then((r) => r.data || []),
    db.from('search_logs').select('query, source, used_fallback, created_at').order('created_at', { ascending: false }).limit(8).then((r) => r.data || []),
    db.from('team_posts').select('name, is_anonymous, created_at, owner:profiles(first_name, last_name)').order('created_at', { ascending: false }).limit(5).then((r) => r.data || []),
    db.from('seeker_posts').select('looking_text, is_anonymous, created_at, owner:profiles(first_name, last_name)').order('created_at', { ascending: false }).limit(5).then((r) => r.data || []),
    db.from('cofounder_posts').select('idea_title, is_anonymous, created_at, owner:profiles(first_name, last_name)').order('created_at', { ascending: false }).limit(5).then((r) => r.data || []),
    ...(['team_posts', 'seeker_posts', 'cofounder_posts'] as const).map((t) => count(db.from(t).select('id', { count: 'exact', head: true }).gt('created_at', startOfTodayBkk()))),
    ...(['team_posts', 'seeker_posts', 'cofounder_posts'] as const).map((t) => count(db.from(t).select('id', { count: 'exact', head: true }).gt('created_at', since).neq('status', 'removed'))),
  ])
  const pendingImports = await count(db.from('event_imports').select('id', { count: 'exact', head: true }).eq('status', 'pending'))
  const postsToday = newToday.slice(0, 3).reduce((a, b) => a + b, 0)
  const sinceLast = newToday.slice(3).reduce((a, b) => a + b, 0)
  const published = events.filter((e) => e.status === 'published')
  const open = published.filter((e) => !isClosed(e))
  const drafts = events.filter((e) => e.status === 'draft')
  const pinned = published.filter((e) => e.is_club && !isClosed(e))

  const perEvent = new Map<string, { view: number; apply: number }>()
  for (const m of metrics) {
    const cur = perEvent.get(m.event_id) || { view: 0, apply: 0 }
    cur[m.kind as 'view' | 'apply']++
    perEvent.set(m.event_id, cur)
  }
  const top = [...perEvent.entries()]
    .map(([id, v]) => ({ e: events.find((x) => x.id === id), ...v }))
    .filter((x) => x.e)
    .sort((a, b) => b.view - a.view)
    .slice(0, 5)
  const maxView = Math.max(1, ...top.map((t) => t.view))

  type Owner = { first_name: string; last_name: string } | null
  const who = (anon: boolean, o: Owner) => (anon ? 'ไม่ระบุชื่อ' : shortName(o?.first_name, o?.last_name))
  const activity = [
    ...recentTeams.map((t) => ({ at: t.created_at, who: who(t.is_anonymous, t.owner as unknown as Owner), what: `โพสต์ชวนคนเข้าทีม ${t.name}` })),
    ...recentSeekers.map((t) => ({ at: t.created_at, who: who(t.is_anonymous, t.owner as unknown as Owner), what: `ประกาศหาทีม: ${t.looking_text}` })),
    ...recentCof.map((t) => ({ at: t.created_at, who: who(t.is_anonymous, t.owner as unknown as Owner), what: `สร้างโปรไฟล์ Co-founder ${t.idea_title ?? ''}` })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6)

  return (
    <>
      <div className="admin-top">
        <div>
          <h1>สวัสดี {admin.profile.first_name || 'แอดมิน'}</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 15 }}>
            {thaiLongToday()} · นี่คือสิ่งที่เกิดขึ้นบนเว็บสัปดาห์นี้
          </p>
        </div>
        <Link href="/admin/events/new" className="btn btn-primary">
          <IconPlus size={18} /> เพิ่มงานแข่ง
        </Link>
      </div>

      <div className="stats">
        <Link href="/admin/users" className="stat">
          <span className="k">ผู้ใช้ทั้งหมด</span>
          <span className="v">{formatNumber(users)}</span>
          <span className="d">
            +{usersWeek} สัปดาห์นี้ · เชื่อม LINE {users ? Math.round((lineLinked / users) * 100) : 0}%
          </span>
        </Link>
        <Link href="/admin/events" className="stat">
          <span className="k">งานที่เปิดรับ</span>
          <span className="v">{open.length}</span>
          <span className="d">{drafts.length ? `${drafts.length} ฉบับร่างรอเผยแพร่` : 'ไม่มีฉบับร่างค้าง'}</span>
        </Link>
        <Link href="/admin/community" className="stat">
          <span className="k">ประกาศชวนคนเข้าทีม</span>
          <span className="v">{teamsOpen}</span>
          <span className="d">+{teamsWeek} สัปดาห์นี้</span>
        </Link>
        <Link href="/admin/community" className="stat">
          <span className="k">โพสต์ใหม่วันนี้</span>
          <span className="v">{postsToday}</span>
          <span className="d">เปิดดูความเหมาะสม</span>
        </Link>
      </div>

      <div className="admin-two" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        <div className="stack" style={{ gap: 20 }}>
          <section className="box" style={{ gap: 6 }}>
            <h2 style={{ marginBottom: 8 }}>ต้องจัดการ</h2>
            {pendingImports > 0 && (
              <Link href="/admin/imports" className="todo">
                <span className="tag tag-ok tag-sm">Hackza</span>
                <span className="stack" style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{pendingImports} งานจาก Hackza รอตรวจ</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    อนุมัติแล้วจะเผยแพร่และแจ้งเตือนคนที่สนใจทันที
                  </span>
                </span>
                <IconChevronRight size={18} />
              </Link>
            )}
            {sinceLast > 0 && (
              <Link href="/admin/community" className="todo">
                <span className="tag tag-blue tag-sm">ตรวจดู</span>
                <span className="stack" style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{sinceLast} โพสต์ใหม่ตั้งแต่เข้าครั้งล่าสุด</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    เลื่อนดูคร่าวๆ ลบได้ถ้าเนื้อหาไม่เหมาะสม
                  </span>
                </span>
                <IconChevronRight size={18} />
              </Link>
            )}
            {drafts.map((d) => (
              <Link key={d.id} href={`/admin/events/${d.id}`} className="todo">
                <span className="tag tag-yellow tag-sm">ร่าง</span>
                <span className="stack" style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>มีงาน “{d.title}” เป็นฉบับร่าง</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    เติมข้อมูลและลิงก์สมัครแล้วเผยแพร่
                  </span>
                </span>
                <IconChevronRight size={18} />
              </Link>
            ))}
            {pinned.map((p) => (
              <Link key={p.id} href={`/admin/events/${p.id}`} className="todo">
                <span className="tag tag-yellow tag-sm">จากชมรม</span>
                <span className="stack" style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{p.title} ปักหมุดอยู่</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    กิจกรรมจากชมรม · แสดงบนสุดของหน้าแรกและหน้างานแข่ง
                  </span>
                </span>
                <IconChevronRight size={18} />
              </Link>
            ))}
            {!pendingImports && !sinceLast && !drafts.length && !pinned.length && (
              <p className="muted" style={{ margin: 0, padding: '8px 4px', fontSize: 14 }}>
                ไม่มีอะไรค้าง 🎉
              </p>
            )}
          </section>

          <section className="box">
            <h2>คำค้นล่าสุด (AI)</h2>
            {logs.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14 }}>ยังไม่มีการค้นหา</p>}
            {logs.map((l, i) => (
              <div key={i} className="row" style={{ gap: 10, fontSize: 14 }}>
                <span className={`tag tag-sm ${l.source === 'line' ? 'tag-ok' : 'tag-blue'}`}>{l.source === 'line' ? 'LINE' : 'เว็บ'}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.query}</span>
                {l.used_fallback && <span className="tag tag-sm tag-grey">fallback</span>}
                <span className="muted" style={{ flex: 'none', fontSize: 12 }}>
                  {adminTime(l.created_at)}
                </span>
              </div>
            ))}
          </section>
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <section className="box" style={{ gap: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2>งานที่คนสนใจ 7 วัน</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                เข้าชม · กดสมัคร
              </span>
            </div>
            {top.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14 }}>ยังไม่มีข้อมูล</p>}
            {top.map((t) => (
              <div key={t.e!.id} className="stack" style={{ gap: 6 }}>
                <span className="row" style={{ justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{t.e!.title}</span>
                  <span className="muted" style={{ flex: 'none' }}>
                    {t.view} · <b style={{ color: 'var(--orange)' }}>{t.apply}</b>
                  </span>
                </span>
                <span className="bar-track">
                  <span style={{ width: `${Math.round((t.view / maxView) * 100)}%` }} />
                </span>
              </div>
            ))}
          </section>
          <section className="box">
            <h2>ความเคลื่อนไหวล่าสุด</h2>
            {activity.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14 }}>ยังไม่มีความเคลื่อนไหว</p>}
            {activity.map((a, i) => (
              <div key={i} className="row" style={{ gap: 10, fontSize: 14, alignItems: 'flex-start' }}>
                <span style={{ flex: 'none', marginTop: 8, width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)' }} />
                <span style={{ flex: 1 }}>
                  <b style={{ fontWeight: 600 }}>{a.who}</b> {a.what}
                </span>
                <span className="muted" style={{ flex: 'none', fontSize: 12 }}>
                  {adminTime(a.at)}
                </span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  )
}
