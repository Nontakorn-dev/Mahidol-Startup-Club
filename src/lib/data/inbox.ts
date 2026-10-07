import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { toPublicAuthor } from '@/lib/data/community'
import { ROLES, type Role } from '@/lib/constants'
import type { PublicAuthor } from '@/lib/types'

export type ConversationRow = {
  id: string
  request_kind: 'message' | 'intro' | 'invite' | 'join'
  request_status: 'none' | 'pending' | 'accepted' | 'declined'
  team_id: string | null
  target_type: string | null
  target_id: string | null
  created_by: string | null
  last_message_at: string
  last_message_preview: string | null
  last_sender_id: string | null
}

type Participant = { conversation_id: string; user_id: string; role: 'requester' | 'recipient'; is_anonymous: boolean; last_read_at: string }

export type InboxItem = {
  id: string
  other: PublicAuthor
  title: string
  preview: string
  at: string
  unread: boolean
  isRequest: boolean
  pendingForMe: boolean
}

const KIND_LABEL: Record<ConversationRow['request_kind'], string> = {
  message: '',
  intro: 'ขอทำความรู้จักกับคุณ',
  invite: 'ชวนเข้าทีม',
  join: 'ขอเข้าร่วมทีม',
}

/** Is the other side's identity still hidden from me? */
export function otherHidden(conv: ConversationRow, other: Participant | undefined) {
  return Boolean(other?.is_anonymous) && conv.request_status !== 'accepted'
}

export async function unreadCount(userId: string): Promise<number> {
  const db = adminClient()
  const { data: mine } = await db
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId)
  if (!mine?.length) return 0
  const { data: convs } = await db
    .from('conversations')
    .select('id, last_message_at, last_sender_id, request_status')
    .in('id', mine.map((m) => m.conversation_id))
  const readAt = new Map(mine.map((m) => [m.conversation_id, m.last_read_at]))
  return (convs || []).filter(
    (c) => c.last_sender_id && c.last_sender_id !== userId && c.last_message_at > (readAt.get(c.id) || ''),
  ).length
}

export async function listInbox(userId: string): Promise<InboxItem[]> {
  const db = adminClient()
  const { data: mine } = await db.from('conversation_participants').select('*').eq('user_id', userId)
  if (!mine?.length) return []
  const ids = mine.map((m) => m.conversation_id)
  const [{ data: convs }, { data: others }] = await Promise.all([
    db.from('conversations').select('*').in('id', ids).order('last_message_at', { ascending: false }),
    db.from('conversation_participants').select('*').in('conversation_id', ids).neq('user_id', userId),
  ])
  const otherIds = (others || []).map((o) => o.user_id)
  const teamIds = (convs || []).map((c) => c.team_id).filter(Boolean)
  const [{ data: profiles }, { data: teams }] = await Promise.all([
    otherIds.length
      ? db.from('profiles').select('id, first_name, last_name, faculty, year, avatar_url, is_verified, skills').in('id', otherIds)
      : Promise.resolve({ data: [] as never[] }),
    teamIds.length ? db.from('team_posts').select('id, name, roles_needed').in('id', teamIds) : Promise.resolve({ data: [] as never[] }),
  ])
  const pmap = new Map((profiles || []).map((p) => [p.id, p]))
  const tmap = new Map((teams || []).map((t) => [t.id, t]))

  return (convs || []).map((c: ConversationRow) => {
    const me = mine.find((m) => m.conversation_id === c.id) as Participant
    const other = (others || []).find((o) => o.conversation_id === c.id) as Participant | undefined
    const author = toPublicAuthor(other ? pmap.get(other.user_id) : null, otherHidden(c, other))
    const team = c.team_id ? tmap.get(c.team_id) : null
    const isRequest = c.request_kind !== 'message'
    let title = author.name
    if (c.request_kind === 'invite' && team && me.role === 'recipient') title = author.name
    const kindText =
      c.request_kind === 'invite' && team
        ? `ชวนเข้าทีม ${team.name}${team.roles_needed?.length ? ` · ${ROLES[team.roles_needed[0] as Role] ?? ''}` : ''}`
        : c.request_kind === 'join' && team
          ? `ขอเข้าร่วมทีม ${team.name}`
          : KIND_LABEL[c.request_kind]
    const pendingForMe = c.request_status === 'pending' && me.role === 'recipient'
    return {
      id: c.id,
      other: author,
      title,
      preview: pendingForMe && kindText ? kindText : c.last_message_preview || kindText || '',
      at: c.last_message_at,
      unread: Boolean(c.last_sender_id && c.last_sender_id !== userId && c.last_message_at > me.last_read_at),
      isRequest,
      pendingForMe,
    }
  })
}

export type ChatMessage = {
  id: string
  mine: boolean
  kind: 'text' | 'system'
  body: string
  attachment: { name: string; url: string } | null
  at: string
}

export type ConversationView = {
  conv: ConversationRow
  myRole: 'requester' | 'recipient'
  other: PublicAuthor
  otherProfileId: string | null
  team: { id: string; name: string; pitch: string; roles_needed: string[]; event: { slug: string; title: string; poster_url: string | null; deadline: string | null } | null } | null
  messages: ChatMessage[]
  canSend: boolean
  canRespond: boolean
  lockedReason: string | null
}

export async function getConversation(convId: string, userId: string): Promise<ConversationView | null> {
  const db = adminClient()
  const { data: parts } = await db.from('conversation_participants').select('*').eq('conversation_id', convId)
  const me = parts?.find((p) => p.user_id === userId) as Participant | undefined
  if (!me) return null
  const other = parts?.find((p) => p.user_id !== userId) as Participant | undefined
  const { data: conv } = await db.from('conversations').select('*').eq('id', convId).single()
  if (!conv) return null
  const hidden = otherHidden(conv, other)
  const { data: otherProfile } = other
    ? await db.from('profiles').select('id, first_name, last_name, faculty, year, avatar_url, is_verified, skills').eq('id', other.user_id).maybeSingle()
    : { data: null }

  let team: ConversationView['team'] = null
  if (conv.team_id) {
    const { data: t } = await db
      .from('team_posts')
      .select('id, name, pitch, roles_needed, event:events(slug, title, poster_url, deadline)')
      .eq('id', conv.team_id)
      .maybeSingle()
    if (t) team = { ...t, event: (t.event as unknown as NonNullable<ConversationView['team']>['event']) ?? null }
  }

  const { data: msgs } = await db
    .from('messages')
    .select('*')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
    .limit(500)

  const paths = (msgs || []).filter((m) => m.attachment_path).map((m) => m.attachment_path as string)
  const signed = new Map<string, string>()
  if (paths.length) {
    const { data } = await db.storage.from('attachments').createSignedUrls(paths, 60 * 60)
    for (const s of data || []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }

  const anyAnonymous = Boolean(me.is_anonymous || other?.is_anonymous)
  const pending = conv.request_status === 'pending'
  const declined = conv.request_status === 'declined'
  let lockedReason: string | null = null
  if (declined) lockedReason = 'คำขอนี้ถูกปฏิเสธแล้ว'
  else if (pending && anyAnonymous)
    lockedReason =
      me.role === 'recipient'
        ? 'ตอบรับก่อนเพื่อเริ่มคุยและเปิดเผยชื่อของทั้งสองฝ่าย'
        : 'รออีกฝ่ายตอบรับ — ชื่อจริงจะแสดงเมื่อตอบรับคำขอแล้ว'

  return {
    conv,
    myRole: me.role,
    other: toPublicAuthor(otherProfile, hidden),
    otherProfileId: hidden ? null : (otherProfile?.id ?? null),
    team,
    messages: (msgs || []).map((m) => ({
      id: m.id,
      mine: m.sender_id === userId,
      kind: m.kind,
      body: m.body,
      attachment: m.attachment_path ? { name: m.attachment_name || 'ไฟล์แนบ', url: signed.get(m.attachment_path) || '#' } : null,
      at: m.created_at,
    })),
    canSend: !lockedReason,
    canRespond: pending && me.role === 'recipient',
    lockedReason,
  }
}
