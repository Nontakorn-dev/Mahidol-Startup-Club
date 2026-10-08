import 'server-only'
import { cookies } from 'next/headers'
import { randomInt } from 'node:crypto'
import { adminClient } from '@/lib/supabase/admin'
import { env, serverEnv } from '@/lib/env'
import { randomToken, signPayload, verifyPayload } from '@/lib/crypto'
import { getLineProfile, isOaFriend } from '@/lib/line/messaging'

// Accounts are always email accounts. LINE is only *linked* to them so the OA can
// push notifications. Three ways to link, all ending in linkLineToUser():
//   1. Website → "เชื่อมต่อ LINE" → LINE Login consent (link mode only)
//   2. Website → QR / button → OA chat with a one-time code → webhook
//   3. OA → personal link with a Messaging API linkToken → sign up/in with email
//      → LINE account-link dialog → `accountLink` webhook event

export const LINK_CODE_TTL_MIN = 15
const NONCE_TTL_MIN = 15
const PENDING_COOKIE = 'msc_line_link'

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

/** Remember the linkToken across sign-up / sign-in (cookie also survives the onboarding hop). */
export async function rememberPendingLink(linkToken: string) {
  const jar = await cookies()
  jar.set(PENDING_COOKIE, signPayload({ t: linkToken }, 10 * 60), {
    httpOnly: true,
    secure: env.siteUrl.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  })
}

/**
 * Turn a linkToken + signed-in user into LINE's account-link dialog URL.
 * LINE then sends an `accountLink` webhook event carrying our nonce.
 */
export async function accountLinkUrl(userId: string, linkToken: string): Promise<string> {
  const nonce = randomToken(24)
  await adminClient().from('line_link_nonces').insert({ nonce, user_id: userId })
  return `https://access.line.me/dialog/bot/accountLink?linkToken=${encodeURIComponent(linkToken)}&nonce=${encodeURIComponent(nonce)}`
}

/** If the visitor arrived from an OA link, return the account-link URL to finish linking (and clear it). */
export async function pendingLinkRedirect(userId: string): Promise<string | null> {
  const jar = await cookies()
  const pending = verifyPayload<{ t: string }>(jar.get(PENDING_COOKIE)?.value)
  if (!pending || !isLinkToken(pending.t)) return null
  try {
    jar.delete(PENDING_COOKIE)
  } catch {
    // read-only cookie store (Server Component render) — expires on its own
  }
  return accountLinkUrl(userId, pending.t)
}

/** Webhook `accountLink` (result ok): map nonce → user and save the LINE User ID. */
export async function consumeNonce(nonce: string, lineUserId: string): Promise<string | null> {
  const db = adminClient()
  const since = new Date(Date.now() - NONCE_TTL_MIN * 60_000).toISOString()
  const { data } = await db.from('line_link_nonces').delete().eq('nonce', nonce).gt('created_at', since).select('user_id').maybeSingle()
  if (!data) return null
  await linkLineToUser(data.user_id, lineUserId, { friend: true })
  return data.user_id
}

export function linkPageUrl(linkToken: string) {
  return `/line/link?linkToken=${encodeURIComponent(linkToken)}`
}
