import type { Metadata } from 'next'
import { requireViewer } from '@/lib/auth'
import OnboardingForm from '@/components/forms/OnboardingForm'

export const metadata: Metadata = { title: 'ตั้งค่าโปรไฟล์' }

export default async function OnboardingPage({ searchParams }: PageProps<'/onboarding'>) {
  const sp = await searchParams
  const viewer = await requireViewer('/onboarding')
  const next = typeof sp.next === 'string' ? sp.next : '/'
  const p = viewer.profile
  return (
    <div style={{ background: 'radial-gradient(100% 40% at 100% 0%, rgba(0,53,173,0.10) 0%, rgba(0,53,173,0) 60%), linear-gradient(180deg, #E6ECF8 0px, #F4F7FC 420px)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 96px' }} className="stack">
        <div className="stack" style={{ gap: 10, marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontWeight: 600, fontSize: 40, lineHeight: 1.2 }}>ยินดีต้อนรับสู่ชมรม 👋</h1>
          <p className="muted" style={{ margin: 0, fontSize: 17 }}>
            บอกเราสั้นๆ ว่าคุณเป็นใคร ถนัดอะไร — เราจะใช้แนะนำงานแข่งและทีมที่ตรงกับคุณ
          </p>
        </div>
        <OnboardingForm
          next={next}
          p={{
            first_name: p.first_name || p.line_display_name || '',
            last_name: p.last_name,
            faculty: p.faculty,
            year: p.year,
            campus: p.campus,
            headline: p.headline,
            skills: p.skills,
            interests: p.interests,
          }}
        />
      </div>
    </div>
  )
}
