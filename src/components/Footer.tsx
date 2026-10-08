import Link from 'next/link'
import Image from 'next/image'
import { SOCIAL } from '@/lib/constants'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="inner">
        <div className="about">
          <Link href="/" style={{ alignSelf: 'flex-start', display: 'flex' }}>
            <Image src="/assets/logo.png" alt="Mahidol Startup Club" width={212} height={64} style={{ height: 64, width: 'auto' }} />
          </Link>
          <p>
            Hands-on. Support. Connect. ชมรมสตาร์ตอัพมหิดล สำหรับคนที่อยากลงมือทำและเจอคนที่ใช่{' '}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 8, fontSize: 14, whiteSpace: 'nowrap' }}>
              <span style={{ flex: 'none', width: 10, height: 10, borderRadius: '50%', background: 'var(--yellow)' }} />
              สนับสนุนโดย iNT มหาวิทยาลัยมหิดล
            </span>
          </p>
        </div>
        <div className="follow">
          <span className="head" style={{ fontWeight: 600, fontSize: 19 }}>
            ติดตามเรา
          </span>
          <span style={{ display: 'flex', gap: 14 }}>
            <a href={SOCIAL.openChat} target="_blank" rel="noopener" aria-label="LINE OpenChat ของชมรม" title="LINE OpenChat" className="social-lg">
              <img src="/assets/line.png" alt="" />
            </a>
            <a href={SOCIAL.instagram} target="_blank" rel="noopener" aria-label="Instagram ของชมรม" title="Instagram" className="social-lg">
              <img src="/assets/instagram.png" alt="" />
            </a>
          </span>
          <span className="muted" style={{ fontSize: 14 }}>
            {SOCIAL.instagramHandle}
          </span>
        </div>
      </div>
    </footer>
  )
}
