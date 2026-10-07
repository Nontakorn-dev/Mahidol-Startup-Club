import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import CofounderForm from '@/components/forms/CofounderForm'
import { requireViewer } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'สร้างโปรไฟล์ Co-founder' }

export default async function CofounderFormPage() {
  const viewer = await requireViewer('/cofounder/new')
  const { data: existing } = await adminClient()
    .from('cofounder_posts')
    .select('*')
    .eq('owner_id', viewer.userId)
    .neq('status', 'removed')
    .maybeSingle()
  return (
    <div className="bg-soft">
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 96px' }} className="stack">
        <div style={{ marginBottom: 24 }}>
          <Crumbs back="/cofounder" trail={[{ label: 'Co-founder', href: '/cofounder' }, { label: existing ? 'แก้ไขโปรไฟล์ Co-founder' : 'สร้างโปรไฟล์ Co-founder' }]} />
          <h1 style={{ margin: '4px 0 0', fontWeight: 600, fontSize: 40, lineHeight: 1.2 }}>{existing ? 'แก้ไขโปรไฟล์ Co-founder' : 'สร้างโปรไฟล์ Co-founder'}</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 16 }}>
            เล่าว่าคุณถนัดอะไร มีไอเดียอะไร และกำลังมองหาใครมาร่วมสร้าง
          </p>
        </div>
        <CofounderForm c={existing ?? undefined} lineLinked={Boolean(viewer.profile.line_user_id)} />
      </div>
    </div>
  )
}
