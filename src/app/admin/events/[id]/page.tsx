import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import EventEditor from '@/components/admin/EventEditor'
import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { shortName } from '@/lib/format'
import type { EventRow } from '@/lib/types'

export const metadata: Metadata = { title: 'แก้ไขงาน' }
export const dynamic = 'force-dynamic'

export default async function EditEventPage({ params, searchParams }: PageProps<'/admin/events/[id]'>) {
  await requireAdmin()
  const { id } = await params
  const sp = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const db = adminClient()
  const { data } = await db.from('events').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  const e = data as EventRow
  let editor: string | null = null
  if (e.updated_by) {
    const { data: p } = await db.from('profiles').select('first_name, last_name').eq('id', e.updated_by).maybeSingle()
    editor = p ? shortName(p.first_name, p.last_name) : null
  }
  return <EventEditor e={e} editor={editor} saved={typeof sp.saved === 'string' ? sp.saved : null} />
}
