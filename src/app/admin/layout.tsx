import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import AdminNav from '@/components/admin/AdminNav'
import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { initialOf, shortName } from '@/lib/format'

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin · Mahidol Startup Club' } }
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()
  const since = admin.profile.admin_last_seen_at ?? new Date(Date.now() - 7 * 86_400_000).toISOString()
  const db = adminClient()
  const counts = await Promise.all(
    (['team_posts', 'seeker_posts', 'cofounder_posts'] as const).map((t) =>
      db.from(t).select('id', { count: 'exact', head: true }).gt('created_at', since).neq('status', 'removed').then((r) => r.count || 0),
    ),
  )
  const newPosts = counts.reduce((a, b) => a + b, 0)
  const pendingImports = await db
    .from('event_imports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .then((r) => r.count || 0)
  const name = shortName(admin.profile.first_name, admin.profile.last_name)
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <Link href="/" className="logo">
          <Image src="/assets/logo.png" alt="Mahidol Startup Club" width={112} height={34} />
        </Link>
        <span className="kicker">ADMIN</span>
        <AdminNav newPosts={newPosts} pendingImports={pendingImports} />
        <Link href="/me" className="admin-me">
          <span className="avatar" style={{ width: 36, height: 36, background: 'var(--yellow)', color: 'var(--navy)', fontWeight: 600 }}>
            {initialOf(admin.profile.first_name)}
          </span>
          <span className="stack" style={{ lineHeight: 1.3 }}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{name}</span>
            <span style={{ color: '#8FA6D6', fontSize: 12 }}>ผู้ดูแลระบบ</span>
          </span>
        </Link>
      </aside>
      <div className="admin-mobile-nav">
        <div className="top">
          <Link href="/">
            <Image src="/assets/logo.png" alt="Mahidol Startup Club" width={100} height={30} />
          </Link>
          <span className="kicker" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted)' }}>
            ADMIN
          </span>
          <span className="spacer" />
          <span className="avatar" style={{ width: 32, height: 32, background: 'var(--yellow)', color: 'var(--navy)', fontSize: 14 }}>
            {initialOf(admin.profile.first_name)}
          </span>
        </div>
        <AdminNav newPosts={newPosts} pendingImports={pendingImports} mobile />
      </div>
      <main className="admin-main">{children}</main>
    </div>
  )
}
