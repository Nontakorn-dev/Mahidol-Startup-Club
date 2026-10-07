import Header from '@/components/Header'
import Footer from '@/components/Footer'
import LineBrowserBanner from '@/components/LineBrowserBanner'
import { getViewer } from '@/lib/auth'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer()
  return (
    <div className="page">
      <Header />
      {viewer && !viewer.profile.line_user_id && <LineBrowserBanner />}
      <main>{children}</main>
      <Footer />
    </div>
  )
}
