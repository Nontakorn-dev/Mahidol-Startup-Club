'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionViewer } from '@/lib/auth'
import * as core from '@/lib/messaging'
import { DAY, HOUR, MINUTE, enforceLimits } from '@/lib/rate-limit'

const StartSchema = z.object({
  targetType: z.enum(['profile', 'seeker', 'team', 'cofounder']),
  targetId: z.uuid(),
  kind: z.enum(['message', 'intro', 'join', 'invite']),
  message: z.string().trim().min(1, 'กรุณาพิมพ์ข้อความ').max(2000),
  teamId: z.uuid().optional().or(z.literal('')),
})

export async function startConversation(_prev: { error?: string } | null, form: FormData): Promise<{ error?: string } | null> {
  let conversationId: string
  try {
    const viewer = await actionViewer()
    // Requests notify the other person (LINE / email): cap them so one account can't spam members or drain the quotas.
    await enforceLimits(`req:${viewer.userId}`, [[6, 10 * MINUTE], [25, DAY]], 'ส่งคำขอถี่เกินไป — ลองใหม่ภายหลัง (จำกัดเพื่อกันสแปมถึงสมาชิก)')
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

export async function sendMessageAction(form: FormData): Promise<{ error?: string; ok?: boolean; conversationId?: string }> {
  try {
    const viewer = await actionViewer()
    const rawConvId = String(form.get('conversationId') || '').trim()
    const targetProfileId = String(form.get('targetProfileId') || '').trim()

    if (!rawConvId && targetProfileId) {
      await enforceLimits(`req:${viewer.userId}`, [[6, 10 * MINUTE], [25, DAY]], 'ส่งคำขอถี่เกินไป — ลองใหม่ภายหลัง')
      const body = String(form.get('body') || '').trim()
      if (!body) return { error: 'กรุณาพิมพ์ข้อความ' }
      const res = await core.startConversation({
        requesterId: viewer.userId,
        targetType: 'profile',
        targetId: z.uuid().parse(targetProfileId),
        kind: 'message',
        message: body.slice(0, 2000),
        anonymous: false,
      })
      revalidatePath('/inbox')
      return { ok: true, conversationId: res.conversationId }
    }

    const conversationId = z.uuid().parse(rawConvId)
    await enforceLimits(`msg:${viewer.userId}`, [[30, MINUTE], [400, DAY]], 'ส่งข้อความถี่เกินไป กรุณารอสักครู่')
    const file = form.get('file')
    await core.sendMessage({
      conversationId,
      senderId: viewer.userId,
      body: String(form.get('body') || ''),
      attachment: file instanceof File && file.size > 0 ? file : null,
    })
    revalidatePath('/inbox')
    return { ok: true, conversationId }
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
