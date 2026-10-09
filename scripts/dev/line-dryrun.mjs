// Sends signed test events to the production webhook in dry-run mode: the bot builds its real
// replies from live data and LINE validates them. Nothing is sent to anyone.
// node --env-file=.env.local scripts/dev/line-dryrun.mjs <LINE userId> [more events…]
import { createHmac } from 'node:crypto'

const uid = process.argv[2] || 'Udryrun000000000000000000000000000'
const ev = (type, extra) => ({ type, replyToken: 'dryrun', source: { type: 'user', userId: uid }, timestamp: Date.now(), mode: 'active', ...extra })
const pb = (data) => ev('postback', { postback: { data } })
const text = (t) => ev('message', { message: { type: 'text', id: '1', text: t } })
const toggles = process.argv.includes('--toggles')
const events = toggles ? [pb('m:t:data_ai'), pb('m:t:data_ai'), pb('m:n:off'), pb('m:n:on')] : [
  ev('follow'),
  pb('m:open'), pb('m:foryou'), pb('m:teams'), pb('m:join'), pb('m:welcome'), pb('m:menu'), text('เมนู'), text('สมัคร'),
  text('งานแข่ง'), text('ใกล้ปิดรับ'), text('หาทีมลง hackathon ฉันทำ UX ได้'), text('งานแข่งด้านการแพทย์'), text('ช่วยเขียนเรียงความ'), text('สวัสดี'), text('ขอบคุณครับ'), text('asdfgh'), ev('message', { message: { type: 'sticker', id: '2', packageId: '1', stickerId: '1' } }),
]
const body = JSON.stringify({ destination: 'x', events })
const sig = createHmac('sha256', process.env.LINE_MESSAGING_CHANNEL_SECRET).update(body).digest('base64')
const res = await fetch('https://mahidolstartup.site/api/line/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-line-signature': sig, 'x-msc-dryrun': '1' }, body })
const { results } = await res.json()
for (const r of results) console.log(`${r.valid ? '✓' : '✗'} ${String(r.event).padEnd(34)} ${r.messages ?? 0} msg ${r.error ?? ''}`)
