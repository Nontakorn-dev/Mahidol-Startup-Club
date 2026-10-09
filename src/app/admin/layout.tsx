import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import AdminNav from '@/components/admin/AdminNav'
import Avatar from '@/components/Avatar'
import { IconBack } from '@/components/icons'
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
  const photo = admin.profile.avatar_url || admin.profile.line_picture_url
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <Link href="/" className="logo">
          <Image src="/assets/logo-2026.png" alt="Mahidol Startup Club" width={112} height={34} />
        </Link>
        <span className="kicker">ADMIN</span>
        <AdminNav newPosts={newPosts} pendingImports={pendingImports} />
        <Link href="/" className="admin-home">
          <IconBack size={16} /> กลับหน้าเว็บไซต์
        </Link>
        <Link href="/me" className="admin-me">
          <Avatar name={name} initial={initialOf(admin.profile.first_name)} src={photo} size={36} brand fontSize={15} />
          <span className="stack" style={{ lineHeight: 1.3 }}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{name}</span>
            <span style={{ color: '#8FA6D6', fontSize: 12 }}>ผู้ดูแลระบบ</span>
          </span>
        </Link>
      </aside>
      <div className="admin-mobile-nav">
        <div className="top">
          <Link href="/" className="admin-back" aria-label="กลับหน้าเว็บไซต์">
            <IconBack size={18} />
            <span>หน้าเว็บ</span>
          </Link>
          <Link href="/" style={{ display: 'inline-flex' }}>
            <Image src="/assets/logo-2026.png" alt="Mahidol Startup Club" width={100} height={30} />
          </Link>
          <span className="kicker" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted)' }}>
            ADMIN
          </span>
          <span className="spacer" />
          <Link href="/me" aria-label="โปรไฟล์ของฉัน" style={{ display: 'inline-flex' }}>
            <Avatar name={name} initial={initialOf(admin.profile.first_name)} src={photo} size={34} brand fontSize={14} />
          </Link>
        </div>
        <AdminNav newPosts={newPosts} pendingImports={pendingImports} mobile />
      </div>
      <main className="admin-main">{children}</main>
    </div>
  )
}
