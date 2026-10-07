// Creates the LINE OA rich menu shown in design/LineMessages.html
// (งานแข่ง · เพื่อนร่วมทีม · ตั้งค่าแจ้งเตือน/เชื่อมบัญชี) and sets it as the default for all users.
//
// Usage:  node --env-file=.env.local scripts/setup-line-richmenu.mjs
// Needs:  LINE_MESSAGING_ACCESS_TOKEN, NEXT_PUBLIC_SITE_URL (the production https URL)

import sharp from 'sharp'

const token = process.env.LINE_MESSAGING_ACCESS_TOKEN
const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
if (!token || !site.startsWith('https://')) {
  console.error('Set LINE_MESSAGING_ACCESS_TOKEN and an https NEXT_PUBLIC_SITE_URL first.')
  process.exit(1)
}

const W = 2500
const H = 843
const third = Math.round(W / 3)
const items = [
  { label: 'งานแข่ง & ทุน', path: '/opportunities?src=line', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3' },
  { label: 'เพื่อนร่วมทีม', path: '/teams?src=line', icon: 'M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M17 6.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM16 14.2a5 5 0 0 1 5.5 5.8' },
  { label: 'ตั้งค่าแจ้งเตือน', message: 'ตั้งค่าแจ้งเตือน', icon: 'M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10.3 20a2 2 0 0 0 3.4 0' },
]

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#0A2558"/>
  ${items
    .map((it, i) => {
      const x = i * third
      return `<g>
      <rect x="${x + 24}" y="24" width="${third - 48}" height="${H - 48}" rx="48" fill="${i === 0 ? '#0035AD' : '#12306E'}"/>
      <g transform="translate(${x + third / 2 - 120}, 170) scale(10)" fill="none" stroke="#FFC726" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${it.icon}"/></g>
      <text x="${x + third / 2}" y="${H - 170}" font-family="Kanit, Thonburi, Tahoma, sans-serif" font-size="110" font-weight="600" fill="#FFFFFF" text-anchor="middle">${it.label.replace('&', '&amp;')}</text>
    </g>`
    })
    .join('\n')}
</svg>`

const image = await sharp(Buffer.from(svg)).png().toBuffer()

async function api(path, init) {
  const res = await fetch(`https://api.line.me/v2/bot${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  })
  if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`)
  return res.headers.get('content-type')?.includes('json') ? res.json() : null
}

const { richMenuId } = await api('/richmenu', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    size: { width: W, height: H },
    selected: true,
    name: 'MSC main menu',
    chatBarText: 'เมนู Mahidol Startup Club',
    areas: items.map((it, i) => ({
      bounds: { x: i * third, y: 0, width: i === 2 ? W - 2 * third : third, height: H },
      // Settings is a message so the bot can answer per user: linked → settings link,
      // not linked → personal account-link link (linkToken).
      action: it.message ? { type: 'message', label: it.label, text: it.message } : { type: 'uri', label: it.label, uri: `${site}${it.path}` },
    })),
  }),
})

const up = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
  body: image,
})
if (!up.ok) throw new Error(`upload ${up.status} ${await up.text()}`)

await api(`/user/all/richmenu/${richMenuId}`, { method: 'POST' })
console.log('Rich menu created and set as default:', richMenuId)
