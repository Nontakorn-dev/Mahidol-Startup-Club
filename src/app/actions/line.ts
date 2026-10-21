'use server'
import { redirect } from 'next/navigation'
import { actionViewer } from '@/lib/auth'
import { accountLinkUrl, readLinkKey } from '@/lib/line/link'

/** "ยืนยัน เชื่อม LINE นี้" on /line/link — only now does LINE's account-link dialog open. */
export async function confirmLineLink(form: FormData) {
  const viewer = await actionViewer()
  const key = readLinkKey(String(form.get('k') || ''))
  if (!key) redirect('/line/link')
  redirect(await accountLinkUrl(viewer.userId, key.t, key.u))
}
