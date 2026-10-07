'use server'
import { z } from 'zod'
import { actionViewer } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'

export async function toggleSaveEvent(eventId: string): Promise<{ saved?: boolean; error?: string }> {
  try {
    const viewer = await actionViewer()
    const id = z.uuid().parse(eventId)
    const db = adminClient()
    const { data } = await db.from('saved_events').select('event_id').eq('user_id', viewer.userId).eq('event_id', id).maybeSingle()
    if (data) {
      await db.from('saved_events').delete().eq('user_id', viewer.userId).eq('event_id', id)
      return { saved: false }
    }
    await db.from('saved_events').insert({ user_id: viewer.userId, event_id: id })
    return { saved: true }
  } catch (err) {
    return { error: (err as Error).message }
  }
}
