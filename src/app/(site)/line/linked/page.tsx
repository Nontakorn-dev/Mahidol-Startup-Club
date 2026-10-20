import Link from 'next/link'
import type { Metadata } from 'next'
import { lineAddFriendUrl } from '@/lib/env'
import { adminClient } from '@/lib/supabase/admin'
import { IconLine } from '@/components/icons'

export const metadata: Metadata = { title: 'เชื่อม LINE' }

const CONTINUE_TTL_MS = 15 * 60_000

/** "n***@gmail.com" — enough to recognise your own account, not enough to learn someone else's. */
function maskEmail(email: string) {
  const [user, domain] = email.split('@')
  return domain ? `${user.slice(0, 1)}***@${domain}` : '***'
}

/** The web account a still-unused "continue" token would sign in to. */
async function continueAccount(token: string): Promise<string | null> {
  const db = adminClient()
  const { data: row } = await db
    .from('line_login_states')
    .select('user_id')
    .eq('continue_token', token)
    .is('continue_used_at', null)
    .gte('created_at', new Date(Date.now() - CONTINUE_TTL_MS).toISOString())
    .maybeSingle()
  if (!row) return null
  const { data } = await db.auth.admin.getUserById(row.user_id)
  return data?.user?.email ? maskEmail(data.user.email) : null
}

// Shown after LINE Login when we come back in a browser without the website session
// (usually LINE's in-app browser on phones). Signing in here (one-time token) needs a tap on a
// button that names the account: a link someone else started can't quietly sign you in to theirs.
export default async function LineLinkedPage({ searchParams }: PageProps<'/line/linked'>) {
  const sp = await searchParams
  const ok = sp.ok === '1'
  const token = typeof sp.t === 'string' && /^[A-Za-z0-9_-]{20,}$/.test(sp.t) ? sp.t : null
  const name = typeof sp.name === 'string' ? sp.name.slice(0, 60) : null
  const error = typeof sp.error === 'string' ? sp.error.slice(0, 200) : null
  const account = ok && token ? await continueAccount(token) : null
  const oa = lineAddFriendUrl()
  const continueUrl = token && account ? `/line/continue?t=${token}` : '/settings/interests?linked=1'
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
              {name ? `บัญชี LINE “${name}” ` : 'LINE ของคุณ '}เชื่อมกับบัญชีเว็บ{account ? <strong style={{ color: 'var(--navy)' }}> {account}</strong> : ''}แล้ว
              <br />
              ต่อไป: เลือกเรื่องที่สนใจ เพื่อรับงานที่ตรงกับคุณ
            </p>
            <div className="row wrap" style={{ gap: 10, justifyContent: 'center' }}>
              <a href={continueUrl} className="btn btn-primary">
                {account ? `ไปต่อในชื่อ ${account} →` : 'เลือกเรื่องที่สนใจ →'}
              </a>
              {oa && (
                <a href={oa} className="btn btn-outline">
                  <IconLine size={18} /> กลับไปแชต LINE
                </a>
              )}
            </div>
            {account && (
              <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                ไม่ใช่บัญชีของคุณ? อย่ากดไปต่อ — เข้าเว็บด้วยบัญชีของคุณเองแล้วกด “เชื่อมต่อ LINE” อีกครั้ง LINE จะย้ายมาที่บัญชีของคุณ
              </p>
            )}
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>{error || 'กรุณาลองใหม่อีกครั้ง'}</p>
            <Link href="/me" className="btn btn-outline">
              กลับไปลองใหม่
            </Link>
          </>
        )}
      </section>
    </div>
  )
}
