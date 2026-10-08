// Installs the two LINE OA rich menus from public/assets/line/richmenu-{guest,member}.png:
//   • guest  — default for everyone: browse + a big "สมัครสมาชิกฟรี" button
//   • member — shown to people who linked their website account (switched by the website,
//              src/lib/line/richmenu.ts, using the aliases "msc-guest" / "msc-member")
// Re-running replaces both menus and re-applies the member menu to every linked account.
//
// Usage:  npm run line:richmenu
// Needs:  LINE_MESSAGING_ACCESS_TOKEN, NEXT_PUBLIC_SITE_URL (https), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
// Artwork: node scripts/line-assets.mjs (same layouts as below)

import { readFileSync } from 'node:fs'

const token = process.env.LINE_MESSAGING_ACCESS_TOKEN
const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
if (!token || !site.startsWith('https://')) {
  console.error('Set LINE_MESSAGING_ACCESS_TOKEN and an https NEXT_PUBLIC_SITE_URL first.')
  process.exit(1)
}

const W = 2500
const H = 1686
const BANNER = 360
// Postbacks are answered in the chat (free replies) — see src/lib/line/bot.ts.
const pb = (label, data) => ({ type: 'postback', label, data, displayText: label })
const uri = (label, path) => ({ type: 'uri', label, uri: `${site}${path}${path.includes('?') ? '&' : '?'}src=line` })

const MENUS = {
  guest: {
    name: 'MSC guest',
    chatBarText: 'เมนู · MSC',
    tiles: [
      { action: pb('งานแข่ง & ทุน', 'm:open') },
      { action: pb('ใกล้ปิดรับ', 'm:closing') },
      { action: pb('หาทีม', 'm:teams') },
      { action: pb('สมัครสมาชิกฟรี', 'm:join'), span: 2 },
      { action: uri('เปิดเว็บไซต์', '/') },
    ],
  },
  member: {
    name: 'MSC member',
    chatBarText: 'เมนู · MSC',
    tiles: [
      { action: pb('งานแข่ง & ทุน', 'm:open') },
      { action: pb('ใกล้ปิดรับ', 'm:closing') },
      { action: pb('ตรงกับฉัน', 'm:foryou') },
      { action: pb('หาทีม', 'm:teams') },
      { action: uri('เปิดเว็บไซต์', '/') },
      { action: pb('บัญชี & ความสนใจ', 'm:account') },
    ],
  },
}

function areas(tiles) {
  const cw = W / 3
  const ch = (H - BANNER) / 2
  let col = 0
  let row = 0
  const out = [{ bounds: { x: 0, y: 0, width: W, height: BANNER }, action: uri('หน้าแรก', '/') }]
  for (const t of tiles) {
    const span = t.span ?? 1
    if (col + span > 3) (col = 0), row++
    out.push({ bounds: { x: Math.round(col * cw), y: Math.round(BANNER + row * ch), width: Math.round(cw * span), height: Math.round(ch) }, action: t.action })
    col += span
  }
  return out
}

async function api(path, init = {}, base = 'https://api.line.me/v2/bot') {
  const res = await fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } })
  if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`)
  return res.headers.get('content-type')?.includes('json') ? res.json() : null
}

const { richmenus: before } = await api('/richmenu/list')
const ids = {}
for (const [key, m] of Object.entries(MENUS)) {
  const { richMenuId } = await api('/richmenu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ size: { width: W, height: H }, selected: true, name: m.name, chatBarText: m.chatBarText, areas: areas(m.tiles) }),
  })
  await api(
    `/richmenu/${richMenuId}/content`,
    { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: readFileSync(new URL(`../public/assets/line/richmenu-${key}.png`, import.meta.url)) },
    'https://api-data.line.me/v2/bot',
  )
  // Point the alias at the new menu (create it the first time).
  const alias = `msc-${key}`
  try {
    await api(`/richmenu/alias/${alias}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ richMenuId }) })
  } catch {
    await api('/richmenu/alias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ richMenuAliasId: alias, richMenuId }) })
  }
  ids[key] = richMenuId
  console.log(`✓ ${m.name}: ${richMenuId} (alias ${alias})`)
}
await api(`/user/all/richmenu/${ids.guest}`, { method: 'POST' })
console.log('✓ guest menu is the default')

// Members keep their menu: re-link every LINE-linked account to the new member menu.
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=line_user_id&line_user_id=not.is.null`, {
    headers: { apikey: process.env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` },
  })
  const users = ((await res.json()) || []).map((r) => r.line_user_id)
  for (let i = 0; i < users.length; i += 500) {
    await api('/richmenu/bulk/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ richMenuId: ids.member, userIds: users.slice(i, i + 500) }) })
  }
  console.log(`✓ member menu linked to ${users.length} account(s)`)
}

// Remove older versions.
for (const m of before) if (!Object.values(ids).includes(m.richMenuId)) await api(`/richmenu/${m.richMenuId}`, { method: 'DELETE' })
