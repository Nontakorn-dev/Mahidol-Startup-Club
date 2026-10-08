import type { Metadata } from 'next'
import ChipSelect from '@/components/ChipSelect'
import SubmitButton from '@/components/SubmitButton'
import { saveInterests } from '@/app/actions/profile'
import { requireViewer } from '@/lib/auth'
import { ROLE_KEYS, type Role } from '@/lib/constants'

export const metadata: Metadata = { title: 'เลือกเรื่องที่สนใจ' }
export const dynamic = 'force-dynamic'

// Same keys as the profile's "สายที่สนใจ" and event tags, with friendlier labels.
const LABEL: Record<Role, string> = {
  developer: '💻 เขียนโปรแกรม / เทค',
  data_ai: '🤖 AI / Data',
  ux_ui: '🎨 ออกแบบ UX/UI',
  business: '📈 ธุรกิจ / สตาร์ตอัพ',
  marketing: '📣 การตลาด / คอนเทนต์',
  hardware: '🔧 ฮาร์ดแวร์ / หุ่นยนต์',
  domain_expert: '🩺 การแพทย์ / สุขภาพ',
}

export default async function InterestsPage({ searchParams }: PageProps<'/settings/interests'>) {
  const sp = await searchParams
  const raw = typeof sp.next === 'string' ? sp.next : '/opportunities'
  const next = raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/settings/interests') ? raw : '/opportunities'
  const viewer = await requireViewer(`/settings/interests?next=${encodeURIComponent(next)}`)
  const p = viewer.profile
  const justLinked = sp.linked === '1'
  const viaLine = Boolean(p.line_user_id && p.line_is_friend)

  return (
    <div className="bg-soft">
      <form action={saveInterests} className="panel stack" style={{ maxWidth: 640, margin: '40px auto 96px', gap: 20 }}>
        {justLinked && <div className="alert alert-ok">เชื่อม LINE สำเร็จ ✓ {p.line_display_name ? `(${p.line_display_name})` : ''}</div>}
        <div className="stack" style={{ gap: 6 }}>
          <h1 style={{ margin: 0, fontWeight: 600, fontSize: 28 }}>เลือกเรื่องที่สนใจ</h1>
          <p className="muted" style={{ margin: 0, fontSize: 15 }}>เลือกได้หลายข้อ — ใช้แนะนำงานแข่ง ทุน และทีมที่ตรงกับคุณ (แก้ได้ทุกเมื่อในโปรไฟล์)</p>
        </div>
        <ChipSelect name="interests" label="เรื่องที่สนใจ" options={ROLE_KEYS.map((k) => ({ value: k, label: LABEL[k] }))} defaultValue={p.interests} />
        <label className="row" style={{ gap: 14, padding: 16, borderRadius: 16, background: 'var(--yellow-soft)', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" name="notify_matches" defaultChecked={p.notify_matches} style={{ width: 22, height: 22, marginTop: 2, flex: 'none' }} />
          <span className="stack" style={{ gap: 4 }}>
            <b style={{ fontSize: 16 }}>🔔 แจ้งเตือนงานที่ตรงกับความสนใจ</b>
            <span className="muted" style={{ fontSize: 14 }}>
              {viaLine ? 'สรุปส่งทาง LINE สัปดาห์ละครั้ง (วันจันทร์ 08:00 น.)' : 'ส่งทางอีเมล — เชื่อม LINE เพื่อรับสรุปทาง LINE แทน'}
            </span>
          </span>
        </label>
        <input type="hidden" name="next" value={next} />
        <div className="row wrap" style={{ gap: 10, justifyContent: 'flex-end' }}>
          <a href={next} className="btn btn-ghost">
            ข้ามไปก่อน
          </a>
          <SubmitButton className="btn btn-primary">บันทึก</SubmitButton>
        </div>
      </form>
    </div>
  )
}
