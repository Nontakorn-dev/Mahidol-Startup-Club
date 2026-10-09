import Link from 'next/link'
import type { Metadata } from 'next'
import Avatar from '@/components/Avatar'
import Crumbs from '@/components/Crumbs'
import { EmptyState } from '@/components/Cards'
import { IconSearch, IconVerified } from '@/components/icons'
import { getViewer } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { facultyLine, initialOf, shortName } from '@/lib/format'
import { ROLES, ROLE_KEYS, type Role } from '@/lib/constants'

export const metadata: Metadata = { title: 'เครือข่ายสมาชิก' }
export const dynamic = 'force-dynamic'

// Member directory (LinkedIn-style): everyone who keeps "แสดงโปรไฟล์ในเครือข่ายสมาชิก" on (the default).
// Shows only what the public profile shows — never email or LINE.

const COLS = 'id, first_name, last_name, faculty, year, avatar_url, line_picture_url, headline, skills, interests, is_verified, created_at'

export default async function PeoplePage({ searchParams }: PageProps<'/people'>) {
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : ''
  const role = typeof sp.role === 'string' && (ROLE_KEYS as string[]).includes(sp.role) ? (sp.role as Role) : undefined
  const viewer = await getViewer()

  let query = adminClient()
    .from('profiles')
    .select(COLS)
    .eq('profile_public', true)
    .eq('onboarded', true)
    .eq('is_suspended', false)
    .neq('first_name', '')
    .order('is_verified', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(120)
  if (role) query = query.contains('interests', [role])
  const { data } = await query
  const needle = q.toLowerCase()
  const people = (data || []).filter((p) =>
    !needle
      ? true
      : [p.first_name, p.last_name, p.headline, p.faculty, ...(p.skills || [])].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)),
  )

  const me = viewer?.profile
  const myCta = !viewer
    ? { href: '/login?next=%2Fme', label: 'สร้างโปรไฟล์ของคุณ' }
    : !me?.headline || !me?.skills?.length
      ? { href: '/me', label: 'เติมโปรไฟล์ให้สมบูรณ์' }
      : { href: '/me', label: 'แก้ไขโปรไฟล์ของฉัน' }
  const href = (r?: Role) => `/people${r || q ? `?${new URLSearchParams({ ...(r ? { role: r } : {}), ...(q ? { q } : {}) })}` : ''}`

  return (
    <div className="bg-soft">
      <section className="page-head">
        <div className="inner">
          <div className="stack" style={{ flex: '1 1 560px', gap: 18 }}>
            <Crumbs back="/" trail={[{ label: 'หน้าแรก', href: '/' }, { label: 'เครือข่าย' }]} />
            <div>
              <h1>เครือข่าย</h1>
              <p className="lead">สร้างโปรไฟล์ของคุณ และค้นพบสมาชิกที่มีทักษะเสริมกัน</p>
            </div>
            <form className="search-box" role="search" action="/people" style={{ maxWidth: 640 }}>
              {role && <input type="hidden" name="role" value={role} />}
              <label htmlFor="pq" className="sr-only">ค้นหาสมาชิก</label>
              <input id="pq" name="q" defaultValue={q} maxLength={60} placeholder="ค้นหาชื่อ คณะ หรือทักษะ เช่น React, Figma" autoComplete="off" enterKeyHint="search" />
              <button type="submit" className="search-go" aria-label="ค้นหา">
                <IconSearch />
              </button>
            </form>
          </div>
          <Link href={myCta.href} className="btn btn-primary btn-pill" style={{ minHeight: 52, padding: '0 26px' }}>
            {myCta.label}
          </Link>
        </div>
      </section>

      <div className="container" style={{ paddingTop: 28, paddingBottom: 96 }}>
        <div className="stack" style={{ gap: 22 }}>
          <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <Link href={href()} className={`filter-chip ${!role ? 'active' : ''}`} scroll={false}>
                ทุกสาย
              </Link>
              {ROLE_KEYS.map((r) => (
                <Link key={r} href={href(r)} className={`filter-chip ${role === r ? 'active' : ''}`} scroll={false}>
                  {ROLES[r]}
                </Link>
              ))}
            </div>
            <span className="muted" style={{ fontSize: 14 }}>
              สมาชิก {people.length} คน
            </span>
          </div>

          {people.length ? (
            <div className="people-grid">
              {people.map((p) => {
                const name = shortName(p.first_name, p.last_name)
                const mine = viewer?.userId === p.id
                return (
                  <Link key={p.id} href={`/u/${p.id}`} className="member-card">
                    <Avatar name={name} initial={initialOf(p.first_name)} src={p.avatar_url || p.line_picture_url} size={72} fontSize={26} />
                    <span className="name">
                      {name}
                      {p.is_verified && (
                        <span title="Mahidol verified" style={{ display: 'inline-flex', color: 'var(--brand)' }}>
                          <IconVerified size={16} />
                        </span>
                      )}
                    </span>
                    <span className="sub">{facultyLine(p.faculty, p.year) || 'สมาชิกชมรม'}</span>
                    {p.headline && <span className="headline">{p.headline}</span>}
                    {(p.skills || []).length > 0 && (
                      <span className="tags">
                        {(p.skills as string[]).slice(0, 3).map((k) => (
                          <span key={k} className="tag-outline">
                            {ROLES[k as Role] ?? k}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="go">{mine ? 'โปรไฟล์ของคุณ' : 'ดูโปรไฟล์'}</span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <EmptyState
              title={q || role ? 'ไม่พบสมาชิกที่ตรงกับการค้นหา' : 'ยังไม่มีสมาชิกในเครือข่าย'}
              body={q || role ? 'ลองค้นด้วยคำอื่น หรือเลือก "ทุกสาย"' : 'สร้างโปรไฟล์เป็นคนแรก แล้วให้สมาชิกคนอื่นค้นพบคุณ'}
              action={
                <Link href={q || role ? '/people' : myCta.href} className="btn btn-primary btn-pill">
                  {q || role ? 'ดูสมาชิกทั้งหมด' : myCta.label}
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
