import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { unsubscribeEmail, unsubscribeUserId } from '@/lib/unsubscribe'

export const metadata: Metadata = { title: 'ยกเลิกรับอีเมล', robots: { index: false } }

async function confirm(form: FormData) {
  'use server'
  const t = String(form.get('t') || '')
  const uid = unsubscribeUserId(t)
  if (uid) await unsubscribeEmail(uid)
  redirect(`/unsubscribe?done=${uid ? 1 : 0}`)
}

export default async function UnsubscribePage({ searchParams }: PageProps<'/unsubscribe'>) {
  const sp = await searchParams
  const t = typeof sp.t === 'string' ? sp.t : ''
  const done = sp.done === '1'
  const valid = done || Boolean(unsubscribeUserId(t))
  return (
    <div className="bg-soft">
      <section className="panel" style={{ maxWidth: 520, margin: '56px auto 96px', textAlign: 'center', alignItems: 'center' }}>
        {done ? (
          <>
            <h1 style={{ margin: 0, fontWeight: 600, fontSize: 28 }}>ยกเลิกรับอีเมลแล้ว</h1>
            <p className="muted" style={{ margin: 0 }}>เราจะไม่ส่งข่าวสารทางอีเมลอีก เปิดรับใหม่ หรือเชื่อม LINE เพื่อรับทาง LINE แทนได้ที่หน้าตั้งค่า</p>
            <Link href="/settings/notifications" className="btn btn-outline btn-pill">ตั้งค่าการแจ้งเตือน</Link>
          </>
        ) : valid ? (
          <form action={confirm} className="stack" style={{ gap: 14, alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontWeight: 600, fontSize: 28 }}>ยกเลิกรับอีเมลข่าวสาร?</h1>
            <p className="muted" style={{ margin: 0 }}>คุณจะไม่ได้รับคำชวนเข้าทีม งานแข่ง และประกาศจากชมรมทางอีเมล (ยังเข้าสู่ระบบด้วยอีเมลได้ตามปกติ)</p>
            <input type="hidden" name="t" value={t} />
            <button type="submit" className="btn btn-primary btn-pill">ยืนยันยกเลิกรับอีเมล</button>
          </form>
        ) : (
          <>
            <h1 style={{ margin: 0, fontWeight: 600, fontSize: 28 }}>ลิงก์ไม่ถูกต้อง</h1>
            <Link href="/settings/notifications" className="btn btn-outline btn-pill">ไปที่ตั้งค่าการแจ้งเตือน</Link>
          </>
        )}
      </section>
    </div>
  )
}
