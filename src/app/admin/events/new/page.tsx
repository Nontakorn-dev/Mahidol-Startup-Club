import type { Metadata } from 'next'
import EventEditor from '@/components/admin/EventEditor'
import { requireAdmin } from '@/lib/auth'

export const metadata: Metadata = { title: 'เพิ่มงานใหม่' }

export default async function NewEventPage() {
  await requireAdmin()
  return <EventEditor />
}
