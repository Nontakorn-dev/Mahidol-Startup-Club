// Renders the LINE OA artwork from the club logo into public/assets/line/:
//   icon.png      640×640  OA profile picture + small logo in chat cards
//   welcome.png  1040×540  hero image of the welcome / help cards
//   richmenu-guest.png / richmenu-member.png  2500×1686 bottom menus — uploaded by setup-line-richmenu.mjs
//
// Usage: node scripts/line-assets.mjs   (needs the "Prompt" font installed for Thai text)
import { mkdirSync, readFileSync, statSync } from 'node:fs'
import sharp from 'sharp'

const OUT = new URL('../public/assets/line/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const asset = (p) => new URL(`../public/assets/${p}`, import.meta.url).pathname

const C = { brand: '#0035AD', navy: '#0A2558', navy2: '#10233F', yellow: '#FFC726', orange: '#F7931E', bg: '#F3F6FC', muted: '#64748B', line: '#DCE4F2' }
const FONT = "Prompt, 'Sukhumvit Set', Thonburi, sans-serif"
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`

// Rocket mark = the left part of the wordmark logo.
const logo = readFileSync(asset('logo.png'))
const rocket = await sharp(logo).extract({ left: 0, top: 0, width: 262, height: 272 }).png().toBuffer()

// ------------------------------------------------------------------ icon.png
{
  const S = 640
  const mark = await sharp(rocket).resize({ height: 430 }).toBuffer()
  const m = await sharp(mark).metadata()
  await sharp({ create: { width: S, height: S, channels: 4, background: '#FFFFFF' } })
    .composite([{ input: mark, left: Math.round((S - m.width) / 2) + 6, top: Math.round((S - m.height) / 2) }])
    .png()
    .toFile(new URL('icon.png', OUT).pathname)
}

// ------------------------------------------------------------------ welcome.png
{
  const W = 1040
  const H = 540
  const art = await sharp(asset('hero-connect.png')).resize(470, 470).png().toBuffer()
  const wordmark = await sharp(logo).resize({ width: 330 }).png().toBuffer()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="${C.bg}"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <circle cx="${W - 250}" cy="${H / 2}" r="250" fill="#E8EEFB"/>
    <image href="${b64(wordmark)}" x="56" y="58" width="330" height="100"/>
    <text x="56" y="250" font-family="${FONT}" font-size="54" font-weight="600" fill="${C.navy}">Find your people.</text>
    <text x="56" y="318" font-family="${FONT}" font-size="54" font-weight="600" fill="${C.brand}">Start building.</text>
    <text x="58" y="378" font-family="${FONT}" font-size="25" fill="${C.muted}">หางานแข่ง · ทุน · ทีม · co-founder ในที่เดียว</text>
    <rect x="56" y="420" width="96" height="10" rx="5" fill="${C.yellow}"/>
    <rect x="160" y="420" width="40" height="10" rx="5" fill="${C.orange}"/>
    <image href="${b64(art)}" x="${W - 485}" y="35" width="470" height="470"/>
  </svg>`
  await sharp(Buffer.from(svg)).png().toFile(new URL('welcome.png', OUT).pathname)
}

// ------------------------------------------------------------------ rich menus
// Two menus (2500×1686): "guest" for people who haven't joined yet (big sign-up button) and
// "member" for linked accounts. Layout = 2 rows × 3 columns under the logo banner; a tile can
// span columns. Keep in sync with scripts/setup-line-richmenu.mjs (same LAYOUTS export).
const ICON = {
  trophy: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z',
  clock: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M5 3 2 6M22 6l-3-3',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  rocket: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
}
export const LAYOUTS = {
  guest: [
    { icon: 'trophy', label: 'งานแข่ง & ทุน', sub: 'ที่เปิดรับอยู่ตอนนี้' },
    { icon: 'clock', label: 'ใกล้ปิดรับ', sub: 'ภายใน 7 วัน', hot: true },
    { icon: 'users', label: 'หาทีม', sub: 'เพื่อนร่วมทีม' },
    { icon: 'rocket', label: 'สมัครสมาชิกฟรี', sub: 'ใช้ Google ได้ · 1 นาที · รับงานที่ตรงกับคุณ', span: 2, primary: true },
    { icon: 'globe', label: 'เปิดเว็บไซต์', sub: 'mahidolstartup.site' },
  ],
  member: [
    { icon: 'trophy', label: 'งานแข่ง & ทุน', sub: 'ที่เปิดรับอยู่ตอนนี้' },
    { icon: 'clock', label: 'ใกล้ปิดรับ', sub: 'ภายใน 7 วัน', hot: true },
    { icon: 'star', label: 'ตรงกับฉัน', sub: 'ตามเรื่องที่สนใจ' },
    { icon: 'users', label: 'หาทีม', sub: 'เพื่อนร่วมทีม' },
    { icon: 'globe', label: 'เปิดเว็บไซต์', sub: 'mahidolstartup.site' },
    { icon: 'bell', label: 'บัญชี & ความสนใจ', sub: 'เลือกเรื่อง · แจ้งเตือน' },
  ],
}

async function renderMenu(name, tilesDef) {
  const W = 2500
  const H = 1686
  const BANNER = 360
  const GAP = 24
  const unit = (W - GAP * 4) / 3
  const ch = (H - BANNER - GAP * 3) / 2
  const wordmark = await sharp(logo).resize({ height: 230 }).png().toBuffer()
  let col = 0
  let row = 0
  const tiles = tilesDef
    .map((m, i) => {
      const span = m.span ?? 1
      if (col + span > 3) (col = 0), row++
      const x = GAP + col * (unit + GAP)
      const y = BANNER + GAP + row * (ch + GAP)
      const w = unit * span + GAP * (span - 1)
      col += span
      const cx = x + w / 2
      const bg = m.primary ? C.brand : '#FFFFFF'
      const fg = m.primary ? '#FFFFFF' : C.navy
      const subFg = m.primary ? '#D6E0F5' : C.muted
      const ring = m.primary ? 'rgba(255,255,255,0.16)' : i % 2 ? '#FFF6DB' : '#E8EEFB'
      const stroke = m.primary ? C.yellow : i % 2 ? C.orange : C.brand
      return `<g>
      <rect x="${x}" y="${y}" width="${w}" height="${ch}" rx="44" fill="${bg}" ${m.primary ? '' : `stroke="${C.line}" stroke-width="3"`}/>
      ${m.hot ? `<rect x="${x + w - 210}" y="${y + 34}" width="176" height="62" rx="31" fill="${C.orange}"/><text x="${x + w - 122}" y="${y + 77}" font-family="${FONT}" font-size="34" font-weight="600" fill="#fff" text-anchor="middle">ด่วน</text>` : ''}
      ${m.primary ? `<rect x="${x + w - 250}" y="${y + 34}" width="216" height="62" rx="31" fill="${C.yellow}"/><text x="${x + w - 142}" y="${y + 77}" font-family="${FONT}" font-size="34" font-weight="600" fill="${C.navy}" text-anchor="middle">แนะนำ</text>` : ''}
      <circle cx="${cx}" cy="${y + 205}" r="104" fill="${ring}"/>
      <g transform="translate(${cx - 66}, ${y + 139}) scale(5.5)" fill="none" stroke="${stroke}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[m.icon]}"/></g>
      <text x="${cx}" y="${y + 410}" font-family="${FONT}" font-size="${m.primary ? 88 : 76}" font-weight="600" fill="${fg}" text-anchor="middle">${esc(m.label)}</text>
      <text x="${cx}" y="${y + 478}" font-family="${FONT}" font-size="44" fill="${subFg}" text-anchor="middle">${esc(m.sub)}</text>
    </g>`
    })
    .join('\n')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E8EEFB"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    <rect width="${W}" height="${BANNER}" fill="url(#b)"/>
    <image href="${b64(wordmark)}" x="70" y="${(BANNER - 230) / 2}" height="230" width="${Math.round((900 / 272) * 230)}"/>
    <text x="${W - 80}" y="160" font-family="${FONT}" font-size="78" font-weight="600" fill="${C.navy}" text-anchor="end">Find your people.</text>
    <text x="${W - 80}" y="250" font-family="${FONT}" font-size="78" font-weight="600" fill="${C.brand}" text-anchor="end">Start building.</text>
    <rect x="${W - 80 - 150}" y="282" width="150" height="14" rx="7" fill="${C.yellow}"/>
    ${tiles}
  </svg>`
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(new URL(`richmenu-${name}.png`, OUT).pathname)
}
await renderMenu('guest', LAYOUTS.guest)
await renderMenu('member', LAYOUTS.member)

for (const f of ['icon.png', 'welcome.png', 'richmenu-guest.png', 'richmenu-member.png']) {
  const m = await sharp(new URL(f, OUT).pathname).metadata()
  console.log(`✓ public/assets/line/${f} ${m.width}×${m.height} ${(statSync(new URL(f, OUT)).size / 1024).toFixed(0)}KB`)
}
