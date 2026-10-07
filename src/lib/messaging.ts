import 'server-only'
import { randomUUID } from 'node:crypto'
import { adminClient } from '@/lib/supabase/admin'
import { resolveTargetOwner, toPublicAuthor } from '@/lib/data/community'
import { notifyUsers } from '@/lib/notify'
import { signPayload } from '@/lib/crypto'
import { facultyLine, shortName } from '@/lib/format'
import { ROLES, type Role } from '@/lib/constants'
import type { NoticeContent } from '@/lib/line/messaging'

export type StartInput = {
  requesterId: string
  targetType: 'profile' | 'seeker' | 'team' | 'cofounder'
  targetId: string
  kind: 'message' | 'intro' | 'join' | 'invite'
  message: string
  anonymous: boolean
  teamId?: string | null
}

const preview = (s: string) => (s.length > 80 ? `${s.slice(0, 80)}…` : s)

async function profileLite(id: string) {
  const { data } = await adminClient()
    .from('profiles')
    .select('id, first_name, last_name, faculty, year, avatar_url, is_verified, skills, is_suspended')
    .eq('id', id)
    .maybeSingle()
  return data
}

export async function startConversation(input: StartInput): Promise<{ conversationId: string }> {
  const db = adminClient()
  const message = input.message.trim().slice(0, 1000)
  if (!message) throw new Error('กรุณาพิมพ์ข้อความ')

  const target = await resolveTargetOwner(input.targetType, input.targetId)
  if (!target) throw new Error('ไม่พบประกาศนี้ หรือถูกลบไปแล้ว')
  if (target.ownerId === input.requesterId) throw new Error('นี่คือประกาศของคุณเอง')

  let kind = input.kind
  let teamId: string | null = null
  if (kind === 'join') {
    if (input.targetType !== 'team') throw new Error('คำขอไม่ถูกต้อง')
    teamId = input.targetId
  }
  if (kind === 'invite') {
    if (!input.teamId) throw new Error('กรุณาเลือกทีม')
    const { data: team } = await db.from('team_posts').select('id, owner_id, status').eq('id', input.teamId).maybeSingle()
    if (!team || team.owner_id !== input.requesterId || team.status !== 'open') throw new Error('เลือกได้เฉพาะทีมที่คุณเป็นเจ้าของและยังเปิดรับอยู่')
    teamId = team.id
  }
  const requesterAnon = kind !== 'invite' && input.anonymous
  const recipientAnon = target.anonymous
  if (kind === 'message' && (requesterAnon || recipientAnon)) kind = 'intro'
  const status = kind === 'message' ? 'none' : 'pending'

  // Re-use an open plain conversation between the same two people.
  if (kind === 'message') {
    const { data: mine } = await db.from('conversation_participants').select('conversation_id, is_anonymous').eq('user_id', input.requesterId)
    const ids = (mine || []).filter((m) => !m.is_anonymous).map((m) => m.conversation_id)
    if (ids.length) {
      const { data: shared } = await db
        .from('conversation_participants')
        .select('conversation_id, is_anonymous')
        .eq('user_id', target.ownerId)
        .in('conversation_id', ids)
      const candidates = (shared || []).filter((s) => !s.is_anonymous).map((s) => s.conversation_id)
      if (candidates.length) {
        const { data: existing } = await db
          .from('conversations')
          .select('id')
          .in('id', candidates)
          .neq('request_status', 'declined')
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (existing) {
          await sendMessage({ conversationId: existing.id, senderId: input.requesterId, body: message })
          return { conversationId: existing.id }
        }
      }
    }
  } else {
    // Avoid duplicate pending requests to the same target.
    const { data: dup } = await db
      .from('conversations')
      .select('id')
      .eq('created_by', input.requesterId)
      .eq('target_type', input.targetType)
      .eq('target_id', input.targetId)
      .eq('request_kind', kind)
      .eq('request_status', 'pending')
      .maybeSingle()
    if (dup) return { conversationId: dup.id }
  }

  const now = new Date().toISOString()
  const { data: conv, error } = await db
    .from('conversations')
    .insert({
      request_kind: kind,
      request_status: status,
      team_id: teamId,
      target_type: input.targetType,
      target_id: input.targetId,
      created_by: input.requesterId,
      last_message_at: now,
      last_message_preview: preview(message),
      last_sender_id: input.requesterId,
    })
    .select('id')
    .single()
  if (error || !conv) throw new Error('สร้างบทสนทนาไม่สำเร็จ')

  await db.from('conversation_participants').insert([
    { conversation_id: conv.id, user_id: input.requesterId, role: 'requester', is_anonymous: requesterAnon, last_read_at: now },
    {
      conversation_id: conv.id,
      user_id: target.ownerId,
      role: 'recipient',
      is_anonymous: recipientAnon,
      last_read_at: new Date(Date.now() - 1000).toISOString(),
    },
  ])
  await db.from('messages').insert({ conversation_id: conv.id, sender_id: input.requesterId, body: message, created_at: now })

  await notifyNewRequest(conv.id, kind, input.requesterId, requesterAnon, target.ownerId, teamId, message)
  return { conversationId: conv.id }
}

async function notifyNewRequest(
  convId: string,
  kind: StartInput['kind'],
  requesterId: string,
  requesterAnon: boolean,
  recipientId: string,
  teamId: string | null,
  message: string,
) {
  const db = adminClient()
  const requester = await profileLite(requesterId)
  const author = toPublicAuthor(requester, requesterAnon)
  const person = { name: author.name, sub: author.faculty_line, anonymous: author.anonymous }
  const url = `/inbox?c=${convId}`
  const accept = signPayload({ a: 'accept', c: convId, u: recipientId }, 60 * 60 * 24 * 30)
  const decline = signPayload({ a: 'decline', c: convId, u: recipientId }, 60 * 60 * 24 * 30)

  type TeamLite = { name: string; roles_needed: string[]; event: { title: string } | null }
  let team: TeamLite | null = null
  if (teamId) {
    const { data } = await db.from('team_posts').select('name, roles_needed, event:events(title)').eq('id', teamId).maybeSingle()
    team = data as unknown as TeamLite | null
  }
  const roles = team?.roles_needed?.map((r) => ROLES[r as Role] ?? r).join(', ')

  let content: NoticeContent
  if (kind === 'invite' && team) {
    content = {
      altText: `${author.name} ชวนคุณเข้าทีม ${team.name}`,
      headerBar: 'มีคนชวนคุณเข้าทีม',
      person,
      title: `ทีม ${team.name}`,
      subtitle: [team.event?.title, roles && `อยากได้ ${roles}`].filter(Boolean).join(' · '),
      quote: message,
      actions: [
        { type: 'uri', label: 'ดูคำชวน', url },
        { type: 'postback', label: 'ตอบรับ', data: accept },
      ],
    }
  } else if (kind === 'join' && team) {
    content = {
      altText: `${author.name} สนใจร่วมทีม ${team.name}`,
      headerBar: 'มีคนสนใจร่วมทีมของคุณ',
      person,
      title: `ทีม ${team.name}`,
      quote: message,
      actions: [
        { type: 'postback', label: 'ยอมรับ', data: accept },
        { type: 'postback', label: 'ปฏิเสธ', data: decline },
      ],
    }
  } else if (kind === 'intro') {
    content = {
      altText: author.anonymous ? 'มีคนขอทำความรู้จัก (ไม่ระบุชื่อ)' : `${author.name} ขอทำความรู้จัก`,
      person: { ...person, name: author.anonymous ? 'มีคนขอทำความรู้จัก (ไม่ระบุชื่อ)' : `${author.name} ขอทำความรู้จัก` },
      title: preview(message),
      actions: [
        { type: 'postback', label: 'ยอมรับ', data: accept },
        { type: 'postback', label: 'ปฏิเสธ', data: decline },
      ],
    }
  } else {
    content = {
      altText: `${author.name} ส่งข้อความถึงคุณ`,
      person,
      title: `${author.name} ส่งข้อความถึงคุณ`,
      quote: message,
      actions: [{ type: 'uri', label: 'ตอบกลับ', url }],
    }
  }
  await notifyUsers([recipientId], 'invites', content, { url })
}

export async function sendMessage(opts: {
  conversationId: string
  senderId: string
  body: string
  attachment?: File | null
}): Promise<void> {
  const db = adminClient()
  const { data: parts } = await db.from('conversation_participants').select('*').eq('conversation_id', opts.conversationId)
  const me = parts?.find((p) => p.user_id === opts.senderId)
  const other = parts?.find((p) => p.user_id !== opts.senderId)
  if (!me) throw new Error('ไม่พบบทสนทนา')
  const { data: conv } = await db.from('conversations').select('*').eq('id', opts.conversationId).single()
  if (!conv) throw new Error('ไม่พบบทสนทนา')
  const anyAnon = me.is_anonymous || other?.is_anonymous
  if (conv.request_status === 'declined') throw new Error('คำขอนี้ถูกปฏิเสธแล้ว')
  if (conv.request_status === 'pending' && anyAnon) throw new Error('รอตอบรับคำขอก่อนจึงจะคุยต่อได้')

  const body = opts.body.trim().slice(0, 2000)
  let attachment_path: string | null = null
  let attachment_name: string | null = null
  if (opts.attachment && opts.attachment.size > 0) {
    if (opts.attachment.size > 10 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 10 MB')
    attachment_name = opts.attachment.name.slice(0, 120)
    const safe = attachment_name.replace(/[^\w.\-]+/g, '_')
    attachment_path = `${opts.conversationId}/${randomUUID()}-${safe}`
    const { error } = await db.storage
      .from('attachments')
      .upload(attachment_path, opts.attachment, { contentType: opts.attachment.type || 'application/octet-stream' })
    if (error) throw new Error('อัปโหลดไฟล์ไม่สำเร็จ')
  }
  if (!body && !attachment_path) throw new Error('กรุณาพิมพ์ข้อความ')

  const now = new Date().toISOString()
  await db.from('messages').insert({
    conversation_id: opts.conversationId,
    sender_id: opts.senderId,
    body,
    attachment_path,
    attachment_name,
    created_at: now,
  })
  // Only ping the other side if this starts a new unread streak (avoid one LINE push per message).
  const otherHadUnread = conv.last_sender_id === opts.senderId && other && conv.last_message_at > other.last_read_at
  await db
    .from('conversations')
    .update({ last_message_at: now, last_message_preview: preview(body || `📎 ${attachment_name}`), last_sender_id: opts.senderId })
    .eq('id', opts.conversationId)
  await db.from('conversation_participants').update({ last_read_at: now }).eq('conversation_id', opts.conversationId).eq('user_id', opts.senderId)

  if (other && !otherHadUnread) {
    const sender = await profileLite(opts.senderId)
    const hidden = me.is_anonymous && conv.request_status !== 'accepted'
    const author = toPublicAuthor(sender, hidden)
    await notifyUsers([other.user_id], 'invites', {
      altText: `ข้อความใหม่จาก ${author.name}`,
      person: { name: author.name, sub: author.faculty_line, anonymous: author.anonymous },
      title: `ข้อความใหม่จาก ${author.name}`,
      quote: body ? preview(body) : `ส่งไฟล์ ${attachment_name}`,
      actions: [{ type: 'uri', label: 'ตอบกลับ', url: `/inbox?c=${opts.conversationId}` }],
    })
  }
}

export async function respondToRequest(conversationId: string, userId: string, accept: boolean): Promise<string> {
  const db = adminClient()
  const { data: conv } = await db.from('conversations').select('*').eq('id', conversationId).single()
  if (!conv) throw new Error('ไม่พบคำขอ')
  const { data: parts } = await db.from('conversation_participants').select('*').eq('conversation_id', conversationId)
  const me = parts?.find((p) => p.user_id === userId)
  const other = parts?.find((p) => p.user_id !== userId)
  if (!me || me.role !== 'recipient') throw new Error('คุณไม่มีสิทธิ์ตอบคำขอนี้')
  if (conv.request_status !== 'pending') return conv.request_status === 'accepted' ? 'ตอบรับไปแล้ว' : 'ตอบคำขอนี้ไปแล้ว'

  const now = new Date().toISOString()
  await db.from('conversations').update({ request_status: accept ? 'accepted' : 'declined' }).eq('id', conversationId)

  if (accept && conv.team_id) {
    // join: the requester joins my team · invite: I (recipient) join the requester's team
    const joiner = conv.request_kind === 'join' ? other?.user_id : conv.request_kind === 'invite' ? userId : null
    if (joiner) {
      const { error } = await db.from('team_members').insert({ team_id: conv.team_id, user_id: joiner })
      if (!error) {
        const { data: team } = await db.from('team_posts').select('members_count, target_size').eq('id', conv.team_id).single()
        if (team) {
          const count = team.members_count + 1
          await db
            .from('team_posts')
            .update({ members_count: count, ...(count >= team.target_size ? { status: 'closed' } : {}) })
            .eq('id', conv.team_id)
        }
      }
    }
  }

  const sysText = accept
    ? conv.request_kind === 'invite'
      ? 'ตอบรับเข้าทีมแล้ว 🎉 คุยกันต่อได้เลย'
      : conv.request_kind === 'join'
        ? 'ยอมรับเข้าทีมแล้ว 🎉 คุยกันต่อได้เลย'
        : 'ตอบรับแล้ว — ตอนนี้เห็นชื่อกันและคุยกันได้เลย'
    : 'คำขอถูกปฏิเสธ'
  await db.from('messages').insert({ conversation_id: conversationId, sender_id: null, kind: 'system', body: sysText, created_at: now })
  await db
    .from('conversations')
    .update({ last_message_at: now, last_message_preview: sysText, last_sender_id: userId })
    .eq('id', conversationId)
  await db.from('conversation_participants').update({ last_read_at: now }).eq('conversation_id', conversationId).eq('user_id', userId)

  if (other) {
    const meProfile = await profileLite(userId)
    const name = accept || !me.is_anonymous ? shortName(meProfile?.first_name, meProfile?.last_name) : 'อีกฝ่าย'
    await notifyUsers([other.user_id], 'invites', {
      altText: accept ? `${name} ตอบรับคำขอของคุณ` : 'คำขอของคุณถูกปฏิเสธ',
      person: accept ? { name, sub: facultyLine(meProfile?.faculty, meProfile?.year) } : undefined,
      title: accept ? `${name} ตอบรับคำขอของคุณแล้ว` : 'คำขอของคุณยังไม่ได้รับการตอบรับในครั้งนี้',
      subtitle: accept ? 'เริ่มคุยกันต่อบนเว็บได้เลย' : 'ลองดูทีมหรือคนอื่นที่ตรงกับคุณได้อีกมาก',
      actions: [{ type: 'uri', label: accept ? 'เปิดแชต' : 'ดูทีมอื่น', url: accept ? `/inbox?c=${conversationId}` : '/teams' }],
    })
  }
  return accept ? 'ตอบรับแล้ว' : 'ปฏิเสธแล้ว'
}

export async function markRead(conversationId: string, userId: string) {
  await adminClient()
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}
