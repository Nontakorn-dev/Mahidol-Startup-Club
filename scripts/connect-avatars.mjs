// Cuts the five people illustrations out of public/assets/hero-connect.png for the compact
// "MSC Connect" map shown on phones and tablets (src/components/ConnectMap.tsx).
//
// Usage: node scripts/connect-avatars.mjs   → public/assets/connect/{team,mentor,startup,partner,investor}.webp

import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const SRC = new URL('../public/assets/hero-connect.png', import.meta.url).pathname
const OUT = new URL('../public/assets/connect/', import.meta.url).pathname
// Circle centres in the 760×760 artwork; R stays just inside each drawn ring so the ring is left out.
const CENTRES = { team: [168, 122], mentor: [568, 120], startup: [639, 347], partner: [159, 552], investor: [562, 584] }
const R = 61
const SIZE = 192

mkdirSync(OUT, { recursive: true })
for (const [name, [cx, cy]] of Object.entries(CENTRES)) {
  await sharp(SRC)
    .extract({ left: cx - R, top: cy - R, width: R * 2, height: R * 2 })
    .resize(SIZE, SIZE, { kernel: 'lanczos3' })
    .webp({ quality: 92 })
    .toFile(`${OUT}${name}.webp`)
  console.log(`✓ ${name}.webp`)
}
