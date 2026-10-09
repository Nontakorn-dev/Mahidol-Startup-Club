import Link from 'next/link'
import Image from 'next/image'
import { getViewer } from '@/lib/auth'
import { unreadCount } from '@/lib/data/inbox'
import { shortName } from '@/lib/format'
import { SOCIAL } from '@/lib/constants'
import NavLinks from './NavLinks'
import UserMenu from './UserMenu'
import { IconChat } from './icons'

export default async function Header() {
  const viewer = await getViewer()
  const unread = viewer ? await unreadCount(viewer.userId) : 0
  const p = viewer?.profile
  return (
    <header className="site-header">
      <div className="bar">
        <Link href="/" className="logo" aria-label="Mahidol Startup Club หน้าแรก">
          <Image src="/assets/logo-2026.png" alt="Mahidol Startup Club" width={172} height={52} priority />
        </Link>
        <NavLinks />
        <div className="header-right">
          <a href={SOCIAL.openChat} target="_blank" rel="noopener" aria-label="LINE OpenChat ของชมรม" title="LINE OpenChat" className="social-btn">
            <img src="/assets/line.png" alt="" />
          </a>
          <a href={SOCIAL.instagram} target="_blank" rel="noopener" aria-label="Instagram ของชมรม" title="Instagram" className="social-btn">
            <img src="/assets/instagram.png" alt="" />
          </a>
          <span aria-hidden="true" className="v-sep" />
          {viewer && p ? (
            <>
              <Link href="/inbox" aria-label={unread ? `ข้อความ ${unread} รายการใหม่` : 'ข้อความ'} title="ข้อความ" className="icon-btn">
                <IconChat size={22} />
                {unread > 0 && <span className="count-badge">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              <UserMenu
                name={shortName(p.first_name, p.last_name)}
                avatarUrl={p.avatar_url || p.line_picture_url}
                email={p.email_is_placeholder ? null : p.email}
                isAdmin={p.role === 'admin'}
                lineLinked={Boolean(p.line_user_id)}
              />
            </>
          ) : (
            <Link href="/login" className="btn btn-primary" style={{ minHeight: 44, padding: '0 22px', borderRadius: 10 }}>
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
