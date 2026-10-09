import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans_Thai, Kanit } from 'next/font/google'
import { Suspense } from 'react'
import NavProgress from '@/components/NavProgress'
import { NavDepth } from '@/components/BackLink'
import './globals.css'

const kanit = Kanit({ subsets: ['thai', 'latin'], weight: ['400', '500', '600'], variable: '--font-kanit', display: 'swap' })
const plex = IBM_Plex_Sans_Thai({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Mahidol Startup Club — Hands-on Experience. Support, Connect.', template: '%s · Mahidol Startup Club' },
  description: 'ชมรมสตาร์ตอัพมหาวิทยาลัยมหิดล หางานแข่ง ทุน ทีม และ co-founder ในที่เดียว พิมพ์สิ่งที่อยากทำ แล้วให้ AI พาไปเจอสิ่งที่ใช่',
  openGraph: { images: ['/assets/hero-connect.png'], locale: 'th_TH', type: 'website' },
  icons: { icon: '/assets/partners/msc-2026.png' },
}

export const viewport: Viewport = { themeColor: '#0035AD', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${kanit.variable} ${plex.variable}`}>
      <body>
        <Suspense fallback={null}>
          <NavProgress />
          <NavDepth />
        </Suspense>
        {children}
      </body>
    </html>
  )
}
