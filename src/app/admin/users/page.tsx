import Link from 'next/link'
import type { Metadata } from 'next'
import { setSuspended, setUserRole } from '@/app/actions/admin'
import { IconLine, IconSearch, IconVerified } from '@/components/icons'
import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { adminTime, facultyLine, shortName } from '@/lib/format'
import SubmitButton from '@/components/SubmitButton'

export const metadata: Metadata = { title: 'ผู้ใช้' }
export const dynamic = 'force-dynamic'

const COLS = '2fr 1.6fr 1.1fr 0.9fr 0.8fr 1.6fr'

export default async function AdminUsersPage({ searchParams }: PageProps<'/admin/users'>) {
  const admin = await requireAdmin()
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const filter = typeof sp.filter === 'string' ? sp.filter : 'all'
  let query = adminClient()
    .from('profiles')
    .select('id, first_name, last_name, email, email_is_placeholder, faculty, year, role, is_verified, is_suspended, line_user_id, line_is_friend, created_at')
    .order('created_at', { ascending: false })
    .limit(300)
  if (q) query = query.or(`first_name.ilike.%${q.replace(/[%,()]/g, '')}%,last_name.ilike.%${q.replace(/[%,()]/g, '')}%,email.ilike.%${q.replace(/[%,()]/g, '')}%`)
  if (filter === 'admin') query = query.eq('role', 'admin')
  if (filter === 'line') query = query.not('line_user_id', 'is', null)
  if (filter === 'noline') query = query.is('line_user_id', null)
  if (filter === 'suspended') query = query.eq('is_suspended', true)
  const { data: users } = await query
  const filters = [
    ['all', 'ทั้งหมด'],
    ['line', 'เชื่อม LINE'],
    ['noline', 'ยังไม่เชื่อม LINE'],
    ['admin', 'แอดมิน'],
    ['suspended', 'ถูกระงับ'],
  ]
  return (
    <>
      <div>
        <h1>ผู้ใช้</h1>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 15 }}>
          ดูสถานะการเชื่อม LINE กำหนดผู้ดูแล และระงับบัญชีที่ไม่เหมาะสม
        </p>
      </div>
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          {filters.map(([k, label]) => (
            <Link key={k} href={`/admin/users?filter=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className={`filter-chip ${filter === k ? 'active' : ''}`}>
              {label}
            </Link>
          ))}
        </div>
        <form className="admin-search" role="search">
          <IconSearch size={18} />
          <input type="hidden" name="filter" value={filter} />
          <label htmlFor="uq" className="sr-only">
            ค้นหาผู้ใช้
          </label>
          <input id="uq" name="q" defaultValue={q} placeholder="ชื่อ หรืออีเมล" />
        </form>
      </div>
      <div className="table">
        <div style={{ minWidth: 980 }}>
          <div className="tr th" style={{ gridTemplateColumns: COLS }}>
            <span>ผู้ใช้</span>
            <span>อีเมล</span>
            <span>LINE</span>
            <span>สมัครเมื่อ</span>
            <span>สิทธิ์</span>
            <span style={{ textAlign: 'right' }}>จัดการ</span>
          </div>
          {(users || []).map((u) => (
            <div key={u.id} className="tr" style={{ gridTemplateColumns: COLS, opacity: u.is_suspended ? 0.6 : 1 }}>
              <span className="stack" style={{ minWidth: 0, lineHeight: 1.4 }}>
                <Link href={`/u/${u.id}`} className="row" style={{ gap: 6, fontWeight: 600, color: 'var(--navy)', textDecoration: 'none' }}>
                  {shortName(u.first_name, u.last_name)}
                  {u.is_verified && (
                    <span style={{ display: 'inline-flex', color: 'var(--brand)' }}>
                      <IconVerified size={16} />
                    </span>
                  )}
                </Link>
                <span className="muted" style={{ fontSize: 13 }}>
                  {facultyLine(u.faculty, u.year)}
                </span>
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                {u.email_is_placeholder ? <span className="muted">— (สมัครผ่าน LINE)</span> : u.email}
              </span>
              <span className="row" style={{ gap: 6, fontSize: 13 }}>
                {u.line_user_id ? (
                  <>
                    <span style={{ display: 'inline-flex', color: '#06C755' }}>
                      <IconLine size={16} />
                    </span>
                    {u.line_is_friend ? 'เพื่อน OA' : 'ยังไม่เพิ่มเพื่อน'}
                  </>
                ) : (
                  <span className="muted">ยังไม่เชื่อม</span>
                )}
              </span>
              <span className="muted" style={{ fontSize: 13 }}>
                {adminTime(u.created_at)}
              </span>
              <span>
                <span className={`tag tag-sm ${u.role === 'admin' ? 'tag-blue' : 'tag-grey'}`}>{u.role === 'admin' ? 'แอดมิน' : 'ผู้ใช้'}</span>
              </span>
              <span className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                {u.id !== admin.userId && (
                  <>
                    <form action={setUserRole}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="role" value={u.role === 'admin' ? 'user' : 'admin'} />
                      <SubmitButton className="btn btn-outline btn-sm">
                        {u.role === 'admin' ? 'ถอดแอดมิน' : 'ตั้งเป็นแอดมิน'}
                      </SubmitButton>
                    </form>
                    <form action={setSuspended}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="suspended" value={u.is_suspended ? '0' : '1'} />
                      <SubmitButton className={u.is_suspended ? 'btn btn-outline btn-sm' : 'btn btn-danger btn-sm'}>
                        {u.is_suspended ? 'ยกเลิกระงับ' : 'ระงับ'}
                      </SubmitButton>
                    </form>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
