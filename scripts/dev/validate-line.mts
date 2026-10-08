// Validates the LINE Flex designs with LINE's own validator (no message is sent).
// npx tsx --conditions=react-server --env-file=.env.local scripts/dev/validate-line.mts
import { WELCOME_IMAGE, eventsCarousel, noticeFlex, textMessage } from '@/lib/line/messaging'

const samples = {
  welcome: noticeFlex({ altText: 'w', imageUrl: WELCOME_IMAGE(), imageAspect: '52:27', title: 'ยินดีต้อนรับสู่ Mahidol Startup Club 👋', subtitle: 'sub', bullets: ['🏆 a', '👥 b'], quote: 'q', actions: [{ type: 'uri', label: 'เชื่อมบัญชีเว็บ', url: '/line/link' }, { type: 'message', label: 'ดูงานแข่ง', text: 'งานแข่ง' }, { type: 'message', label: 'วิธีค้นหา', text: 'วิธีค้นหา' }] }),
  invite: noticeFlex({ altText: 'i', headerBar: 'มีคนชวนคุณเข้าทีม', badge: 'ตรงกับสกิลของคุณ', person: { name: 'พิมพ์ชนก ส.', sub: 'ICT ปี 3' }, title: 'ทีม HealthBridge', subtitle: 'ลง TED Youth', quote: 'สนใจไหม', facts: [{ label: 'ตำแหน่ง', value: 'Developer' }], actions: [{ type: 'postback', label: 'ยอมรับ', data: 'x' }, { type: 'postback', label: 'ปฏิเสธ', data: 'y' }] }),
  events: eventsCarousel('e', [{ title: 'Thai Traditional Medicine Hackathon', category: 'การแข่งขัน', subtitle: 'ปิดรับ 9 ต.ค. 2569', imageUrl: 'https://mahidolstartup.site/assets/line/welcome.png', url: '/opportunities/x', badge: 'อีก 1 วัน 2 ชม.', badgeTone: 'red' }], '/opportunities'),
  text: textMessage('hi', [{ label: '🏆 งานแข่งที่เปิดอยู่', text: 'งานแข่ง' }, { label: 'เว็บ', url: '/' }]),
}
for (const [name, msg] of Object.entries(samples)) {
  const res = await fetch('https://api.line.me/v2/bot/message/validate/reply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.LINE_MESSAGING_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [msg] }),
  })
  console.log(name, res.status, res.ok ? '✓ valid' : await res.text())
}
