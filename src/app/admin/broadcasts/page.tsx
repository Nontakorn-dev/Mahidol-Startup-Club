import type { Metadata } from 'next'
import BroadcastForm from '@/components/admin/BroadcastForm'
import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { emailEnabled, lineMessagingEnabled } from '@/lib/env'
import { adminTime } from '@/lib/format'

export const metadata: Metadata = { title: 'ประกาศข่าวสาร' }
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export default async function BroadcastsPage() {
  await requireAdmin()
  const db = adminClient()
  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count || 0)
  const [all, subscribers, lineFriends, history, events] = await Promise.all([
    count(db.from('profiles').select('id', { count: 'exact', head: true }).eq('is_suspended', false)),
    count(db.from('profiles').select('id', { count: 'exact', head: true }).eq('is_suspended', false).eq('notify_announcements', true)),
    count(db.from('profiles').select('id', { count: 'exact', head: true }).eq('line_is_friend', true).not('line_user_id', 'is', null)),
    db.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(30).then((r) => r.data || []),
    db.from('events').select('id, title').eq('status', 'published').order('created_at', { ascending: false }).then((r) => r.data || []),
  ])
  const AUD: Record<string, string> = { subscribers: 'ผู้รับประกาศจากชมรม', all: 'ทุกคน', saved_event: 'คนที่บันทึกงาน' }
  return (
    <>
      <div>
        <h1>ประกาศข่าวสาร</h1>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 15 }}>
          ส่งข่าวจากชมรมผ่าน LINE OA ให้คนที่เชื่อม LINE แล้ว และส่งทางอีเมลให้คนที่ยังไม่ได้เชื่อม
        </p>
      </div>
      <div className="stats">
        <div className="stat">
          <span className="k">ผู้ใช้ทั้งหมด</span>
          <span className="v">{all}</span>
        </div>
        <div className="stat">
          <span className="k">เปิดรับประกาศจากชมรม</span>
          <span className="v">{subscribers}</span>
        </div>
        <div className="stat">
          <span className="k">รับทาง LINE ได้</span>
          <span className="v">{lineFriends}</span>
          <span className="d">{lineMessagingEnabled() ? 'LINE OA พร้อมใช้งาน' : 'ยังไม่ได้ตั้งค่า LINE OA'}</span>
        </div>
        <div className="stat">
          <span className="k">อีเมล</span>
          <span className="v" style={{ fontSize: 22 }}>{emailEnabled() ? 'พร้อม' : 'ยังไม่ตั้งค่า'}</span>
          <span className="d">สำหรับคนที่ไม่ได้เชื่อม LINE</span>
        </div>
      </div>
      <div className="admin-two" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        <BroadcastForm events={events} />
        <section className="box">
          <h2>ประวัติการส่ง</h2>
          {history.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14 }}>ยังไม่เคยส่งประกาศ</p>}
          {history.map((b) => {
            const s = b.stats as { line?: number; email?: number; skipped?: number; failed?: number; digest?: number; recipients?: number }
            return (
              <div key={b.id} className="stack" style={{ gap: 2, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <span className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <b style={{ fontWeight: 600 }}>{b.title}</b>
                  <span className="muted" style={{ fontSize: 12, flex: 'none' }}>
                    {adminTime(b.created_at)}
                  </span>
                </span>
                <span className="muted" style={{ fontSize: 13 }}>
                  {AUD[b.audience]} · LINE {s.line ?? 0} · อีเมล {s.email ?? 0} · สรุปรายวัน {s.digest ?? 0} · ข้าม {s.skipped ?? 0}
                  {s.failed ? ` · ล้มเหลว ${s.failed}` : ''}
                </span>
              </div>
            )
          })}
        </section>
      </div>
    </>
  )
}
