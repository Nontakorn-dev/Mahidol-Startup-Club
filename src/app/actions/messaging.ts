'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionViewer } from '@/lib/auth'
import * as core from '@/lib/messaging'

const StartSchema = z.object({
  targetType: z.enum(['profile', 'seeker', 'team', 'cofounder']),
  targetId: z.uuid(),
  kind: z.enum(['message', 'intro', 'join', 'invite']),
  message: z.string().trim().min(1, 'กรุณาพิมพ์ข้อความ').max(1000),
  teamId: z.uuid().optional().or(z.literal('')),
})

export async function startConversation(_prev: { error?: string } | null, form: FormData): Promise<{ error?: string } | null> {
  let conversationId: string
  try {
    const viewer = await actionViewer()
    const input = StartSchema.parse({
      targetType: form.get('targetType'),
      targetId: form.get('targetId'),
      kind: form.get('kind'),
      message: form.get('message'),
      teamId: form.get('teamId') || undefined,
    })
    const res = await core.startConversation({
      requesterId: viewer.userId,
      ...input,
      teamId: input.teamId || null,
      anonymous: form.get('anonymous') === 'on',
    })
    conversationId = res.conversationId
  } catch (err) {
    return { error: err instanceof z.ZodError ? err.issues[0].message : (err as Error).message }
  }
  redirect(`/inbox?c=${conversationId}`)
}

export async function sendMessageAction(form: FormData): Promise<{ error?: string; ok?: boolean }> {
  try {
    const viewer = await actionViewer()
    const conversationId = z.uuid().parse(form.get('conversationId'))
    const file = form.get('file')
    await core.sendMessage({
      conversationId,
      senderId: viewer.userId,
      body: String(form.get('body') || ''),
      attachment: file instanceof File && file.size > 0 ? file : null,
    })
    revalidatePath('/inbox')
    return { ok: true }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

export async function respondAction(form: FormData) {
  const viewer = await actionViewer()
  const conversationId = z.uuid().parse(form.get('conversationId'))
  await core.respondToRequest(conversationId, viewer.userId, form.get('accept') === '1')
  revalidatePath('/inbox')
  redirect(`/inbox?c=${conversationId}`)
}

export async function markReadAction(conversationId: string) {
  const viewer = await actionViewer()
  await core.markRead(z.uuid().parse(conversationId), viewer.userId)
}
