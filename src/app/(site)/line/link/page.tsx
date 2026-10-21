import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getViewer } from '@/lib/auth'
import { readLinkKey } from '@/lib/line/link'
import { getLineProfile } from '@/lib/line/messaging'
import { confirmLineLink } from '@/app/actions/line'
import { maskEmail } from '@/lib/format'
import { IconLine } from '@/components/icons'
import SubmitButton from '@/components/SubmitButton'

export const metadata: Metadata = { title: 'ยืนยันการเชื่อม LINE', referrer: 'no-referrer' }

// Personal link sent by the LINE OA (/line/link?k=…). It never links on its own: the page names the
// LINE account and the web account, and only the confirm button opens LINE's account-link dialog.
export default async function LineLinkPage({ searchParams }: PageProps<'/line/link'>) {
  const sp = await searchParams
  const k = typeof sp.k === 'string' ? sp.k : ''
  const key = readLinkKey(k)
  if (!key) {
    return (
      <div className="bg-soft">
        <section className="panel stack" style={{ maxWidth: 520, margin: '48px auto 96px', gap: 16, textAlign: 'center', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontWeight: 600, fontSize: 24 }}>ลิงก์เชื่อม LINE หมดอายุหรือไม่ถูกต้อง</h1>
          <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
            กลับไปที่แชต LINE แล้วพิมพ์ “เชื่อมบัญชี” เพื่อขอลิงก์ใหม่ (ลิงก์ใช้ได้ 10 นาที) หรือกด “เชื่อมต่อ LINE” ในหน้าบัญชีของฉัน
          </p>
          <Link href="/me#line" className="btn btn-outline">
            ไปที่บัญชีของฉัน
          </Link>
        </section>
      </div>
    )
  }

  const viewer = await getViewer()
  if (!viewer) redirect(`/login?from=line&next=${encodeURIComponent(`/line/link?k=${k}`)}`)
  const line = await getLineProfile(key.u).catch(() => null)
  const account = viewer.email ? maskEmail(viewer.email) : 'บัญชีของคุณ'

  return (
    <div className="bg-soft">
      <section className="panel stack" style={{ maxWidth: 520, margin: '48px auto 96px', gap: 18, textAlign: 'center', alignItems: 'center' }}>
        <span style={{ width: 64, height: 64, borderRadius: 20, background: '#E7F8EE', color: '#06C755', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconLine size={34} />
        </span>
        <h1 style={{ margin: 0, fontWeight: 600, fontSize: 26 }}>ยืนยันการเชื่อม LINE</h1>
        <div className="row" style={{ gap: 14, padding: '14px 18px', borderRadius: 16, background: 'var(--bg)', alignItems: 'center', textAlign: 'left' }}>
          {line?.pictureUrl ? (
            <img src={line.pictureUrl} alt="" width={52} height={52} style={{ borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
          ) : (
            <span style={{ width: 52, height: 52, borderRadius: '50%', background: '#E7F8EE', flex: 'none' }} />
          )}
          <span className="stack" style={{ gap: 2 }}>
            <span className="muted" style={{ fontSize: 13 }}>บัญชี LINE</span>
            <strong style={{ fontSize: 18 }}>{line?.displayName ?? 'ไม่ทราบชื่อ'}</strong>
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
          จะได้รับแจ้งเตือนทั้งหมดของบัญชีเว็บ <strong>{account}</strong>
          <br />
          รวมถึงคำชวนเข้าทีมและข้อความใหม่ในกล่องข้อความ
        </p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, padding: '10px 14px', borderRadius: 12, background: '#FEF3C7', color: '#78350F' }}>
          ถ้านี่ไม่ใช่ LINE ของคุณ อย่ากดยืนยัน — อาจมีคนส่งลิงก์นี้มาเพื่อรับแจ้งเตือนของคุณ
        </p>
        <form action={confirmLineLink} className="row wrap" style={{ gap: 10, justifyContent: 'center' }}>
          <input type="hidden" name="k" value={k} />
          <SubmitButton className="btn btn-line">ใช่ นี่คือ LINE ของฉัน — เชื่อมเลย</SubmitButton>
          <Link href="/" className="btn btn-outline">
            ยกเลิก
          </Link>
        </form>
      </section>
    </div>
  )
}
