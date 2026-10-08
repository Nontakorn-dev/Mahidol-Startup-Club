import 'server-only'
import { serverEnv } from '@/lib/env'

// Per-person bottom menu: everyone sees the "guest" menu (big "สมัครสมาชิกฟรี"); people who
// linked their website account get the "member" menu. Menus are installed by
// scripts/setup-line-richmenu.mjs under the aliases below. Switching menus is free (not a message).

const API = 'https://api.line.me/v2/bot'
let memberMenuId: { id: string; at: number } | null = null

async function memberMenu(token: string): Promise<string | null> {
  if (memberMenuId && Date.now() - memberMenuId.at < 10 * 60_000) return memberMenuId.id
  const res = await fetch(`${API}/richmenu/alias/msc-member`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) })
  if (!res.ok) return null
  const { richMenuId } = (await res.json()) as { richMenuId: string }
  memberMenuId = { id: richMenuId, at: Date.now() }
  return richMenuId
}

/** Member menu when linked, back to the default (guest) menu otherwise. Never throws. */
export async function setLineMenu(lineUserId: string, member: boolean): Promise<void> {
  const token = serverEnv().lineMessagingToken
  if (!token || !lineUserId) return
  try {
    if (member) {
      const id = await memberMenu(token)
      if (id) await fetch(`${API}/user/${encodeURIComponent(lineUserId)}/richmenu/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    } else {
      await fetch(`${API}/user/${encodeURIComponent(lineUserId)}/richmenu`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    }
  } catch (err) {
    console.error('LINE menu switch failed', err)
  }
}
