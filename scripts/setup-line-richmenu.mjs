// Creates the LINE OA rich menu (logo banner + 6 buttons) from public/assets/line/richmenu.png
// and sets it as the default for everyone. Re-running replaces the previous menu.
//
// Usage:  npm run line:richmenu
// Needs:  LINE_MESSAGING_ACCESS_TOKEN, NEXT_PUBLIC_SITE_URL (the production https URL)
// Artwork: node scripts/line-assets.mjs (regenerates richmenu.png — keep the layout below in sync)

import { readFileSync } from 'node:fs'

const token = process.env.LINE_MESSAGING_ACCESS_TOKEN
const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
if (!token || !site.startsWith('https://')) {
  console.error('Set LINE_MESSAGING_ACCESS_TOKEN and an https NEXT_PUBLIC_SITE_URL first.')
  process.exit(1)
}

const NAME = 'MSC main menu'
const W = 2500
const H = 1686
const BANNER = 360
const cw = W / 3
const ch = (H - BANNER) / 2
const uri = (label, path) => ({ type: 'uri', label, uri: `${site}${path}${path.includes('?') ? '&' : '?'}src=line` })
// Postbacks: the bot answers in the chat (results + a link to the website). Replies are free,
// so tapping the menu never uses the monthly push quota. Handled in src/lib/line/bot.ts.
const pb = (label, data) => ({ type: 'postback', label, data, displayText: label })

const tiles = [
  pb('งานแข่ง & ทุน', 'm:open'),
  pb('ใกล้ปิดรับ', 'm:closing'),
  pb('ตรงกับฉัน', 'm:foryou'),
  pb('หาทีม', 'm:teams'),
  pb('ค้นหาด้วยประโยค', 'm:help'),
  pb('บัญชี & ความสนใจ', 'm:account'),
]
const areas = [
  { bounds: { x: 0, y: 0, width: W, height: BANNER }, action: uri('หน้าแรก', '/') },
  ...tiles.map((action, i) => ({
    bounds: { x: Math.round((i % 3) * cw), y: Math.round(BANNER + Math.floor(i / 3) * ch), width: Math.round(cw), height: Math.round(ch) },
    action,
  })),
]

async function api(path, init = {}) {
  const res = await fetch(`https://api.line.me/v2/bot${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } })
  if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`)
  return res.headers.get('content-type')?.includes('json') ? res.json() : null
}

const { richMenuId } = await api('/richmenu', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ size: { width: W, height: H }, selected: true, name: NAME, chatBarText: 'เมนู · MSC', areas }),
})

const image = readFileSync(new URL('../public/assets/line/richmenu.png', import.meta.url))
const up = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
  body: image,
})
if (!up.ok) throw new Error(`upload ${up.status} ${await up.text()}`)

await api(`/user/all/richmenu/${richMenuId}`, { method: 'POST' })

// Remove older copies of this menu.
const { richmenus } = await api('/richmenu/list')
for (const m of richmenus) if (m.name === NAME && m.richMenuId !== richMenuId) await api(`/richmenu/${m.richMenuId}`, { method: 'DELETE' })

console.log('✓ Rich menu set as default:', richMenuId)
