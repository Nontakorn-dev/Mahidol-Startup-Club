import 'server-only'
import { randomInt } from 'node:crypto'
import { adminClient } from '@/lib/supabase/admin'
import { env, serverEnv } from '@/lib/env'
import { randomToken, signPayload, verifyPayload } from '@/lib/crypto'
import { getLineProfile, isOaFriend } from '@/lib/line/messaging'
import { setLineMenu } from '@/lib/line/richmenu'

// Accounts are always email accounts. LINE is only *linked* to them so the OA can
// push notifications. Three ways to link, all ending in linkLineToUser():
//   1. Website → "เชื่อมต่อ LINE" → LINE Login consent (link mode only)
//   2. Website → QR / button → OA chat with a one-time code → webhook
//   3. OA → personal link with a Messaging API linkToken → sign up/in with email
//      → confirmation page naming the LINE account → LINE account-link dialog → `accountLink` webhook event

export const LINK_CODE_TTL_MIN = 15
const NONCE_TTL_MIN = 15

/** Save LINE User ID ↔ email account. A LINE account belongs to one web account; re-linking moves it. */
export async function linkLineToUser(
  userId: string,
  lineUserId: string,
  extra: { displayName?: string | null; picture?: string | null; friend?: boolean | null } = {},
) {
  const db = adminClient()
  await db
    .from('profiles')
    .update({ line_user_id: null, line_display_name: null, line_picture_url: null, line_is_friend: false, line_linked_at: null })
    .eq('line_user_id', lineUserId)
    .neq('id', userId)
  let { displayName, picture } = extra
  if (displayName === undefined) {
    const p = await getLineProfile(lineUserId).catch(() => null)
    displayName = p?.displayName ?? null
    picture = p?.pictureUrl ?? null
  }
  // The OA's own answer is the reliable one (LINE Login's friendship API needs a linked OA).
  const friend = extra.friend === true ? true : ((await isOaFriend(lineUserId)) ?? extra.friend ?? null)
  const { data: me } = await db.from('profiles').select('avatar_url').eq('id', userId).single()
  await db
    .from('profiles')
    .update({
      line_user_id: lineUserId,
      line_display_name: displayName,
      line_picture_url: picture ?? null,
      line_linked_at: new Date().toISOString(),
      ...(friend === null ? {} : { line_is_friend: friend }),
      ...(me?.avatar_url || !picture ? {} : { avatar_url: picture }),
    })
    .eq('id', userId)
  await setLineMenu(lineUserId, true)
}

// ------------------------------------------------------------------ 2. one-time code

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Reuse the user's unexpired code or mint a new 6-character one. */
export async function getOrCreateLinkCode(userId: string): Promise<string> {
  const db = adminClient()
  const since = new Date(Date.now() - (LINK_CODE_TTL_MIN - 2) * 60_000).toISOString()
  const { data: existing } = await db
    .from('line_link_codes')
    .select('code')
    .eq('user_id', userId)
    .is('used_at', null)
    .gt('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing) return existing.code
  for (let i = 0; i < 5; i++) {
    const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
    const { error } = await db.from('line_link_codes').insert({ code, user_id: userId })
    if (!error) return code
  }
  throw new Error('สร้างรหัสเชื่อมบัญชีไม่สำเร็จ')
}

export const LINK_CODE_RE = /(?:เชื่อมบัญชี|link)\s*[:：]?\s*([A-HJ-NP-Z2-9]{6})\b/i

/** Called by the webhook when someone sends "เชื่อมบัญชี ABC123" to the OA. */
export async function consumeLinkCode(code: string, lineUserId: string): Promise<string | null> {
  const db = adminClient()
  const since = new Date(Date.now() - LINK_CODE_TTL_MIN * 60_000).toISOString()
  const { data } = await db
    .from('line_link_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code', code.toUpperCase())
    .is('used_at', null)
    .gt('created_at', since)
    .select('user_id')
    .maybeSingle()
  if (!data) return null
  await linkLineToUser(data.user_id, lineUserId, { friend: true })
  return data.user_id
}

/** `line.me/R/oaMessage` deep link that opens the OA chat with the code pre-filled. */
export function oaMessageUrl(text: string): string | null {
  const id = env.lineOaId.trim()
  if (!id) return null
  const basic = id.startsWith('@') ? id : `@${id}`
  return `https://line.me/R/oaMessage/${encodeURIComponent(basic)}/?${encodeURIComponent(text)}`
}

// ------------------------------------------------------------------ 3. OA account link (linkToken)

/** Messaging API: issue a single-use linkToken (valid 10 minutes) for a LINE user. */
export async function issueLinkToken(lineUserId: string): Promise<string> {
  const res = await fetch(`https://api.line.me/v2/bot/user/${encodeURIComponent(lineUserId)}/linkToken`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serverEnv().lineMessagingToken}` },
  })
  if (!res.ok) throw new Error(`linkToken ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return ((await res.json()) as { linkToken: string }).linkToken
}

export const isLinkToken = (t: string | null | undefined): t is string => Boolean(t && /^[A-Za-z0-9_-]{10,200}$/.test(t))
const isLineUserId = (u: unknown): u is string => typeof u === 'string' && /^U[0-9a-f]{32}$/.test(u)

/**
 * The personal link the OA sends: the linkToken signed together with the LINE user it was issued
 * for. A linkToken alone links *whoever opens the link* to the LINE account that requested it,
 * so someone could send their own link to a member and receive that member's notifications —
 * the page behind this link names the LINE account and asks for a confirmation first.
 */
export function linkPageUrl(linkToken: string, lineUserId: string) {
  return `/line/link?k=${encodeURIComponent(signPayload({ t: linkToken, u: lineUserId }, 10 * 60))}`
}

/** linkToken + LINE user id from a `/line/link?k=` value (null when forged, malformed or older than 10 min). */
export function readLinkKey(k: string | null | undefined): { t: string; u: string } | null {
  const v = verifyPayload<{ t?: unknown; u?: unknown }>(k)
  return v && typeof v.t === 'string' && isLinkToken(v.t) && isLineUserId(v.u) ? { t: v.t, u: v.u } : null
}

/**
 * Turn a confirmed linkToken + signed-in user into LINE's account-link dialog URL.
 * LINE then sends an `accountLink` webhook event carrying our nonce; the nonce remembers which
 * LINE account the person confirmed, and any other account is refused.
 */
export async function accountLinkUrl(userId: string, linkToken: string, lineUserId: string): Promise<string> {
  const nonce = randomToken(24)
  await adminClient().from('line_link_nonces').insert({ nonce, user_id: userId, line_user_id: lineUserId })
  return `https://access.line.me/dialog/bot/accountLink?linkToken=${encodeURIComponent(linkToken)}&nonce=${encodeURIComponent(nonce)}`
}

/** Webhook `accountLink` (result ok): map nonce → user and save the LINE User ID. */
export async function consumeNonce(nonce: string, lineUserId: string): Promise<string | null> {
  const db = adminClient()
  const since = new Date(Date.now() - NONCE_TTL_MIN * 60_000).toISOString()
  const { data } = await db.from('line_link_nonces').delete().eq('nonce', nonce).gt('created_at', since).select('user_id, line_user_id').maybeSingle()
  if (!data) return null
  if (data.line_user_id && data.line_user_id !== lineUserId) {
    console.error('accountLink: LINE account differs from the one the member confirmed — not linked')
    return null
  }
  await linkLineToUser(data.user_id, lineUserId, { friend: true })
  return data.user_id
}
