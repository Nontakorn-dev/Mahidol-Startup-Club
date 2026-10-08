import Link from 'next/link'
import type { Metadata } from 'next'
import { lineAddFriendUrl } from '@/lib/env'
import { IconLine } from '@/components/icons'
import AutoContinue from './AutoContinue'

export const metadata: Metadata = { title: 'เชื่อม LINE' }

// Shown after LINE Login when we come back in a browser without the website session
// (usually LINE's in-app browser on phones). It signs the person in here automatically
// (one-time token) and continues to "เลือกเรื่องที่สนใจ".
export default async function LineLinkedPage({ searchParams }: PageProps<'/line/linked'>) {
  const sp = await searchParams
  const ok = sp.ok === '1'
  const token = typeof sp.t === 'string' && /^[A-Za-z0-9_-]{20,}$/.test(sp.t) ? sp.t : null
  const name = typeof sp.name === 'string' ? sp.name.slice(0, 60) : null
  const error = typeof sp.error === 'string' ? sp.error.slice(0, 200) : null
  const oa = lineAddFriendUrl()
  const continueUrl = token ? `/line/continue?t=${token}` : '/settings/interests?linked=1'
  return (
    <div className="bg-soft">
      <section className="panel stack" style={{ maxWidth: 520, margin: '48px auto 96px', gap: 16, textAlign: 'center', alignItems: 'center' }}>
        <span style={{ width: 64, height: 64, borderRadius: 20, background: ok ? '#E7F8EE' : '#FEE2E2', color: ok ? '#06C755' : '#B91C1C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
          {ok ? <IconLine size={34} /> : '!'}
        </span>
        <h1 style={{ margin: 0, fontWeight: 600, fontSize: 26 }}>{ok ? 'เชื่อม LINE สำเร็จ ✓' : 'เชื่อม LINE ไม่สำเร็จ'}</h1>
        {ok ? (
          <>
            <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
              {name ? `บัญชี LINE “${name}” ` : 'LINE ของคุณ '}เชื่อมกับบัญชีเว็บแล้ว
              <br />
              ต่อไป: เลือกเรื่องที่สนใจ เพื่อรับงานที่ตรงกับคุณ
            </p>
            {token && <AutoContinue href={continueUrl} />}
            <div className="row wrap" style={{ gap: 10, justifyContent: 'center' }}>
              <a href={continueUrl} className="btn btn-primary">
                เลือกเรื่องที่สนใจ →
              </a>
              {oa && (
                <a href={oa} className="btn btn-outline">
                  <IconLine size={18} /> กลับไปแชต LINE
                </a>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>{error || 'กรุณาลองใหม่อีกครั้ง'}</p>
            <Link href="/settings/notifications" className="btn btn-outline">
              กลับไปลองใหม่
            </Link>
          </>
        )}
      </section>
    </div>
  )
}
