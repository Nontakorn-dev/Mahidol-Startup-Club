import Link from 'next/link'
import Image from 'next/image'
import { SOCIAL } from '@/lib/constants'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="inner">
        <div className="about">
          <Link href="/" className="logo-link">
            <Image src="/assets/logo.png" alt="Mahidol Startup Club" width={212} height={64} className="logo" />
          </Link>
          <p className="mantra-sm">
            <span>Hands-on Experience.</span> <span className="accent">Support, Connect.</span>
          </p>
          <p className="desc">ชมรมสตาร์ตอัพมหิดล สำหรับคนที่อยากลงมือทำและเจอคนที่ใช่</p>
          <span className="backed">
            <span className="dot" aria-hidden="true" />
            สนับสนุนโดย iNT มหาวิทยาลัยมหิดล
          </span>
        </div>
        <div className="follow">
          <span className="head">ติดตามเรา</span>
          <span className="icons">
            <a href={SOCIAL.openChat} target="_blank" rel="noopener" aria-label="LINE OpenChat ของชมรม" title="LINE OpenChat" className="social-lg">
              <img src="/assets/line.png" alt="" />
            </a>
            <a href={SOCIAL.instagram} target="_blank" rel="noopener" aria-label="Instagram ของชมรม" title="Instagram" className="social-lg">
              <img src="/assets/instagram.png" alt="" />
            </a>
          </span>
          <span className="handle">{SOCIAL.instagramHandle}</span>
        </div>
      </div>
    </footer>
  )
}
