import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import DeletePostButton from '@/components/DeletePostButton'
import CofounderForm from '@/components/forms/CofounderForm'
import { requireViewer } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'ลงประกาศหา Co-Founder' }

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
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px var(--gutter) 96px' }} className="stack">
        <div style={{ marginBottom: 24 }}>
          <Crumbs back="/teams?tab=cofounder" trail={[{ label: 'หาทีม & Co-Founder', href: '/teams?tab=cofounder' }, { label: existing ? 'แก้ไขประกาศ' : 'ลงประกาศหา Co-Founder' }]} />
          <h1 style={{ margin: '4px 0 0', fontWeight: 600, fontSize: 36, lineHeight: 1.2 }}>{existing ? 'แก้ไขประกาศหา Co-Founder' : 'ลงประกาศหา Co-Founder'}</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 16 }}>
            ระบุความเชี่ยวชาญของคุณ รายละเอียดโปรเจกต์ และ Co-Founder ที่ต้องการ
          </p>
        </div>
        <CofounderForm c={existing ?? undefined} lineLinked={Boolean(viewer.profile.line_user_id)} />
        {existing && <DeletePostButton type="cofounder" id={existing.id} />}
      </div>
    </div>
  )
}
