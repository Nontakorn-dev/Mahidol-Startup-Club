import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import LoginForm from '@/components/LoginForm'
import ConnectMap from '@/components/ConnectMap'
import AuthCompleter from '@/components/AuthCompleter'
import { enabledProviders } from '@/lib/auth-providers'
import { IconBack, IconLine } from '@/components/icons'
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
      {/* Desktop / iPad landscape: navy brand panel */}
      <section className="login-brand">
        <Link href="/" className="login-logo">
          <Image src="/assets/logo.png" alt="Mahidol Startup Club" width={146} height={44} />
        </Link>
        <div className="login-brand-body">
          <ConnectMap dark className="login-map" />
          <h2 className="mantra">
            <span className="line">Hands-on Experience.</span>
            <span className="line accent">Support, Connect.</span>
          </h2>
        </div>
        <span className="login-backed">สนับสนุนโดย iNT มหาวิทยาลัยมหิดล</span>
      </section>

      <section className="login-side">
        <div className="login-top">
          <Link href="/" className="login-back" aria-label="กลับหน้าแรก">
            <IconBack size={18} />
            <span className="txt">หน้าแรก</span>
          </Link>
          <Link href="/" className="login-top-logo">
            <Image src="/assets/logo.png" alt="Mahidol Startup Club" width={146} height={44} />
          </Link>
        </div>
        <div className="login-card">
          {fromLine && (
            <div className="login-line-note">
              <IconLine size={20} />
              <span>สมัครหรือเข้าสู่ระบบ แล้วระบบจะพาไปเชื่อมกับ LINE ให้ทันที</span>
            </div>
          )}
          {returning ? (
            <AuthCompleter next={next} code={str('code')} tokenHash={str('token_hash')} type={str('type')} providerError={providerError} />
          ) : (
            <>
              {error && <div className="alert alert-error">{error}</div>}
              <LoginForm next={next} google={google} initialMode={sp.mode === 'signup' || fromLine ? 'signup' : 'signin'} />
            </>
          )}
          <p className="login-terms">
            การเข้าสู่ระบบถือว่าคุณยอมรับ <Link href="/terms">ข้อตกลงการใช้งาน</Link> และ <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
          </p>
        </div>
      </section>
    </div>
  )
}
