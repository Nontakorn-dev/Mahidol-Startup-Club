import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import LoginForm, { GoogleButton } from '@/components/LoginForm'
import AuthCompleter from '@/components/AuthCompleter'
import { enabledProviders } from '@/lib/auth-providers'
import { IconCheck, IconLine } from '@/components/icons'
import { getViewer } from '@/lib/auth'

export const metadata: Metadata = { title: 'เข้าสู่ระบบ' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams
  const raw = typeof sp.next === 'string' ? sp.next : '/'
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)
  // Coming back from Google (?code) or an email button (?token_hash): finish sign-in in the browser.
  const returning = Boolean(str('code') || str('token_hash') || str('error_description'))
  if (!returning && (await getViewer())) redirect(next)
  const providerError = str('error_description')
  const error = !returning ? (str('error') ?? null) : null
  const fromLine = sp.from === 'line'
  const { google } = returning ? { google: false } : await enabledProviders()

  return (
    <div className="login-wrap">
      <section className="login-brand">
        <Link href="/" style={{ alignSelf: 'flex-start', display: 'inline-flex', padding: '8px 16px', borderRadius: 14, background: '#fff' }}>
          <Image src="/assets/logo.png" alt="Mahidol Startup Club" width={146} height={44} />
        </Link>
        <div className="stack" style={{ gap: 28, maxWidth: 520 }}>
          <Image
            src="/assets/hero-connect.png"
            alt="MSC Connect: คุณเชื่อมกับเพื่อนร่วมทีม Mentor Startup Partner และนักลงทุน"
            width={380}
            height={380}
            style={{ width: '100%', maxWidth: 380, height: 'auto', alignSelf: 'center', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.25))' }}
          />
          <h1>
            Find your people.
            <br />
            <span>Start building.</span>
          </h1>
          <div className="bullets">
            {['หางานแข่ง ทุน และโครงการบ่มเพาะในที่เดียว', 'เจอทีมและ co-founder ที่สกิลเสริมกัน', 'แจ้งเตือนผ่าน LINE ทันทีเมื่อมีคนชวนเข้าทีม'].map((t) => (
              <span key={t}>
                <i>
                  <IconCheck size={16} />
                </i>
                {t}
              </span>
            ))}
          </div>
        </div>
        <span style={{ fontSize: 13, color: '#A9BCE8' }}>สนับสนุนโดย iNT มหาวิทยาลัยมหิดล</span>
      </section>

      <section className="login-side">
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Crumbs back="/" trail={[{ label: 'หน้าแรก', href: '/' }, { label: 'เข้าสู่ระบบ' }]} />
        </div>
        <div className="login-card">
          <div>
            <h2 style={{ margin: 0, fontWeight: 600, fontSize: 30, lineHeight: 1.2 }}>ยินดีต้อนรับ</h2>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 15 }}>
              เข้าสู่ระบบหรือสมัครสมาชิกในขั้นตอนเดียว
            </p>
          </div>
          {fromLine && (
            <div className="row" style={{ gap: 12, padding: '12px 14px', borderRadius: 14, background: '#E7F8EE', color: '#065F2C', fontSize: 14, alignItems: 'flex-start' }}>
              <span style={{ display: 'inline-flex', color: '#06C755', marginTop: 2 }}>
                <IconLine size={22} />
              </span>
              <span>
                <b>เชื่อมบัญชีกับ LINE</b>
                <br />
                สมัครหรือเข้าสู่ระบบด้วยอีเมล แล้วระบบจะพาไปยืนยันกับ LINE ทันที — จากนั้นข่าวสารจะส่งเข้า LINE OA ของคุณ
              </span>
            </div>
          )}
          {returning ? (
            <AuthCompleter next={next} code={str('code')} tokenHash={str('token_hash')} type={str('type')} providerError={providerError} />
          ) : (
            <>
              {error && <div className="alert alert-error">{error}</div>}
              {google && (
                <>
                  <GoogleButton next={next} />
                  <div className="divider">หรือใช้อีเมล</div>
                </>
              )}
              <LoginForm next={next} />
            </>
          )}
          {!fromLine && (
            <span className="row muted" style={{ fontSize: 13, gap: 8, alignItems: 'flex-start' }}>
              <span style={{ display: 'inline-flex', color: '#06C755' }}>
                <IconLine size={18} />
              </span>
              เข้าสู่ระบบแล้ว เชื่อม LINE ได้ที่หน้าโปรไฟล์ เพื่อรับข่าวสารผ่าน LINE OA
            </span>
          )}
          <p className="muted" style={{ margin: 0, fontSize: 12, textAlign: 'center' }}>
            การเข้าสู่ระบบถือว่าคุณยอมรับ <Link href="/terms">ข้อตกลงการใช้งาน</Link> และ <Link href="/privacy">นโยบายความเป็นส่วนตัว (PDPA)</Link>
          </p>
        </div>
      </section>
    </div>
  )
}
