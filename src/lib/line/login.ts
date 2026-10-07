import 'server-only'
import { serverEnv } from '@/lib/env'

// LINE Login v2.1 (OpenID Connect). https://developers.line.biz/en/docs/line-login/integrate-line-login/

export function lineAuthorizeUrl(opts: { state: string; nonce: string; redirectUri: string }) {
  const { lineLoginChannelId } = serverEnv()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: lineLoginChannelId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    nonce: opts.nonce,
    scope: 'profile openid',
    // Shows "add the Official Account as a friend" on the consent screen
    // (requires the LINE Login channel to be linked to the OA).
    bot_prompt: 'aggressive',
  })
  return `https://access.line.me/oauth2/v2.1/authorize?${params}`
}

export type LineIdentity = {
  sub: string
  name: string | null
  picture: string | null
  email: string | null
  accessToken: string
}

export async function exchangeLineCode(code: string, redirectUri: string, nonce: string): Promise<LineIdentity> {
  const { lineLoginChannelId, lineLoginChannelSecret } = serverEnv()
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: lineLoginChannelId,
      client_secret: lineLoginChannelSecret,
    }),
  })
  if (!tokenRes.ok) throw new Error(`LINE token exchange failed (${tokenRes.status})`)
  const token = (await tokenRes.json()) as { id_token?: string; access_token: string }
  if (!token.id_token) throw new Error('LINE did not return an id_token')

  // Let LINE validate signature, audience, expiry and nonce for us.
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: token.id_token, client_id: lineLoginChannelId, nonce }),
  })
  if (!verifyRes.ok) throw new Error(`LINE id_token verification failed (${verifyRes.status})`)
  const claims = (await verifyRes.json()) as { sub: string; name?: string; picture?: string; email?: string }
  return {
    sub: claims.sub,
    name: claims.name ?? null,
    picture: claims.picture ?? null,
    email: claims.email ?? null,
    accessToken: token.access_token,
  }
}

/** Whether this LINE user has added our OA as a friend (needs the Login access token). */
export async function lineFriendshipStatus(accessToken: string): Promise<boolean | null> {
  const res = await fetch('https://api.line.me/friendship/v1/status', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const body = (await res.json()) as { friendFlag: boolean }
  return body.friendFlag
}
