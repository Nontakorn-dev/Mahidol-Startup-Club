import type { Role } from '@/lib/constants'

// One vocabulary for "what is this about" — used to read the user's text (src/lib/ai/intent.ts)
// and to match events (src/lib/search.ts). Add a topic here and both sides learn it.
//  • detect: words in a search sentence that mean this topic (Thai, English, slang, typos)
//  • match:  words to look for in event titles / descriptions / organisers / places
//  • role:   the skill with the same name ("AI", "ออกแบบ") — used to tell "งานด้าน AI" (topic)
//            from "ฉันทำ AI ได้" (the user's skill)

export type Topic = { key: string; label: string; detect: RegExp; match: string[]; role?: Role; kind?: 'org' }

export const TOPICS: Topic[] = [
  { key: 'health', label: 'การแพทย์/สุขภาพ', role: 'domain_expert', detect: /การแพทย์|สุขภาพ|แพทย์|หมอ|เภสัช|พยาบาล|ทันต|โรงพยาบาล|ชีวการแพทย์|medic\w*|health\w*|clinic\w*|hospital|pharma\w*|biotech|nursing|dental|wellness/i, match: ['healthtech', 'health', 'healthcare', 'สุขภาพ', 'การแพทย์', 'แพทย์', 'medical', 'medicine', 'medtech', 'clinical', 'hospital', 'โรงพยาบาล', 'เภสัช', 'pharma', 'biotech', 'ชีวการแพทย์', 'พยาบาล', 'nursing', 'ทันต', 'dental', 'wellness', 'สุขภาพจิต', 'mental health'] },
  { key: 'ai', label: 'AI / Data', role: 'data_ai', detect: /\bai\b|เอไอ|ปัญญาประดิษฐ์|machine learning|\bml\b|deep learning|data science|ดาต้า|\bdata\b|genai|\bllm\b|agentic|chatbot|computer vision/i, match: ['ai', 'เอไอ', 'artificial intelligence', 'ปัญญาประดิษฐ์', 'machine learning', 'data', 'ดาต้า', 'genai', 'llm', 'agentic', 'agent', 'computer vision', 'opencv'] },
  { key: 'programming', label: 'เขียนโปรแกรม/ซอฟต์แวร์', role: 'developer', detect: /เขียนโปรแกรม|เขียนโค้ด|โปรแกรมมิ่ง|programming|coding|\bcode\b|software|ซอฟต์แวร์|\bapp\b|แอป|web ?dev|เว็บไซต์|developer|\bdevs?\b/i, match: ['programming', 'coding', 'software', 'ซอฟต์แวร์', 'developers', 'developer', 'เขียนโปรแกรม', 'เขียนโค้ด', 'hackathon', 'แฮกกาธอน', 'แอปพลิเคชัน', 'application development', 'codex', 'github', 'gitlab', 'devops'] },
  { key: 'design', label: 'ออกแบบ', role: 'ux_ui', detect: /ออกแบบ|ดีไซน์|design\w*|\bux\b|\bui\b|figma|กราฟิก|graphic/i, match: ['design', 'ออกแบบ', 'ดีไซน์', 'ux', 'ui', 'กราฟิก', 'graphic'] },
  { key: 'marketing', label: 'การตลาด/คอนเทนต์', role: 'marketing', detect: /การตลาด|marketing|มาร์เก็ตติ้ง|content|คอนเทนต์|branding|แบรนด์|โฆษณา|social media/i, match: ['marketing', 'การตลาด', 'content', 'คอนเทนต์', 'creator', 'branding', 'แบรนด์', 'โฆษณา'] },
  { key: 'business', label: 'ธุรกิจ', role: 'business', detect: /ธุรกิจ|business|case competition|business case|เคส|แผนธุรกิจ|\bcase\b/i, match: ['business', 'ธุรกิจ', 'case', 'เคส', 'แผนธุรกิจ', 'strategy', 'กลยุทธ์'] },
  { key: 'hardware', label: 'หุ่นยนต์/ฮาร์ดแวร์', role: 'hardware', detect: /หุ่นยนต์|robot\w*|hardware|ฮาร์ดแวร์|\biot\b|อิเล็กทรอนิกส์|embedded|drone|โดรน|arduino/i, match: ['robot', 'หุ่นยนต์', 'hardware', 'ฮาร์ดแวร์', 'iot', 'อิเล็กทรอนิกส์', 'embedded', 'drone', 'โดรน'] },
  { key: 'startup', label: 'สตาร์ตอัพ', detect: /startup|สตาร์[ทต]อั[พป]|ผู้ประกอบการ|entrepreneur\w*|founder|ยุววิสาหกิจ/i, match: ['startup', 'สตาร์ตอัพ', 'สตาร์ทอัพ', 'entrepreneur', 'ผู้ประกอบการ', 'founder', 'ยุววิสาหกิจ', 'incubat', 'accelerat'] },
  { key: 'innovation', label: 'นวัตกรรม', detect: /นวัตกรรม|innovat\w*/i, match: ['innovation', 'innovative', 'นวัตกรรม'] },
  { key: 'environment', label: 'สิ่งแวดล้อม/ความยั่งยืน', detect: /สิ่งแวดล้อม|ยั่งยืน|sustainab\w*|\besg\b|climate|ภูมิอากาศ|โลกร้อน|green|ขยะ|waste|carbon|คาร์บอน|รีไซเคิล|recycl\w*/i, match: ['sustainab', 'ความยั่งยืน', 'ยั่งยืน', 'esg', 'climate', 'green', 'สิ่งแวดล้อม', 'waste', 'ขยะ', 'carbon', 'คาร์บอน', 'recycl', 'sdg'] },
  { key: 'energy', label: 'พลังงาน', detect: /พลังงาน|energy|solar|โซลาร์|\bev\b|ยานยนต์ไฟฟ้า|ไฟฟ้า/i, match: ['energy', 'พลังงาน', 'solar', 'โซลาร์', 'ev', 'ยานยนต์ไฟฟ้า', 'ไฟฟ้า'] },
  { key: 'food', label: 'อาหาร/เครื่องดื่ม', detect: /อาหาร|food|เครื่องดื่ม|beverage|ร้านอาหาร|bev\b/i, match: ['food', 'อาหาร', 'เครื่องดื่ม', 'beverage', 'bev', 'bite'] },
  { key: 'agri', label: 'เกษตร', detect: /เกษตร|agri\w*|farm\w*|ฟาร์ม/i, match: ['agri', 'เกษตร', 'farm', 'ฟาร์ม'] },
  { key: 'education', label: 'การศึกษา', detect: /การศึกษา|education|edtech|การเรียน|learning/i, match: ['education', 'edtech', 'การศึกษา', 'learning', 'การเรียน', 'academic'] },
  { key: 'finance', label: 'การเงิน/Fintech', detect: /fintech|ฟินเทค|การเงิน|finance|financial|ลงทุน|invest\w*|banking|ธนาคาร|payment/i, match: ['fintech', 'ฟินเทค', 'financial technology', 'digital banking', 'payment', 'e-wallet', 'การเงินดิจิทัล', 'investment', 'การลงทุน', 'insurtech'] },
  { key: 'social', label: 'สังคม/Social impact', detect: /social|สังคม|ชุมชน|community|\bsdgs?\b|เพื่อสังคม/i, match: ['social', 'สังคม', 'ชุมชน', 'community', 'sdg', 'เพื่อสังคม', 'un-habitat', 'ngo'] },
  { key: 'city', label: 'เมือง', detect: /เมือง|smart city|\bcity\b|cities|urban|คลอง/i, match: ['city', 'cities', 'urban', 'smart city', 'การพัฒนาเมือง', 'พัฒนาเมือง', 'เมืองอัจฉริยะ', 'ผังเมือง', 'เมืองน่าอยู่', 'คลอง', 'klong'] },
  { key: 'tourism', label: 'ท่องเที่ยว/โรงแรม', detect: /ท่องเที่ยว|tourism|travel|โรงแรม|hospitality/i, match: ['tourism', 'travel', 'ท่องเที่ยว', 'โรงแรม', 'hospitality'] },
  { key: 'game', label: 'เกม', detect: /เกม|\bgames?\b|gaming|esport\w*|game jam/i, match: ['game', 'เกม', 'gaming', 'esport', 'vr', 'ar'] },
  { key: 'blockchain', label: 'Blockchain/Web3', detect: /blockchain|บล็อกเชน|web3|crypto|คริปโต/i, match: ['blockchain', 'บล็อกเชน', 'web3', 'crypto'] },
  { key: 'media', label: 'สื่อ/วิดีโอ', detect: /วิดีโอ|video|คลิป|film|ภาพยนตร์|หนังสั้น|content creator|ครีเอเตอร์|podcast|ถ่ายภาพ|photo/i, match: ['video', 'วิดีโอ', 'คลิป', 'film', 'ภาพยนตร์', 'หนังสั้น', 'creator', 'ครีเอเตอร์', 'podcast', 'photo'] },
  { key: 'leadership', label: 'ผู้นำ/Leadership', detect: /leadership|ผู้นำ|leader/i, match: ['leadership', 'leader', 'ผู้นำ', 'fellow'] },
  { key: 'research', label: 'วิจัย', detect: /วิจัย|research|นักวิจัย/i, match: ['research', 'วิจัย', 'showcase'] },
  // Organisers people ask for by name
  { key: 'chula', kind: 'org', label: 'จุฬาฯ', detect: /จุฬา|chula\w*/i, match: ['จุฬา', 'chula', 'chulalongkorn'] },
  { key: 'mahidol', kind: 'org', label: 'มหิดล', detect: /มหิดล|mahidol/i, match: ['มหิดล', 'mahidol'] },
  { key: 'thammasat', kind: 'org', label: 'ธรรมศาสตร์', detect: /ธรรมศาสตร์|thammasat|(^|\s)มธ\.?(\s|$)/i, match: ['ธรรมศาสตร์', 'thammasat', 'tbs'] },
  { key: 'kasetsart', kind: 'org', label: 'เกษตรศาสตร์', detect: /เกษตรศาสตร์|kasetsart/i, match: ['เกษตรศาสตร์', 'kasetsart'] },
  { key: 'cmu', kind: 'org', label: 'มช.', detect: /มหาวิทยาลัยเชียงใหม่|\bcmu\b|มช\.?/i, match: ['เชียงใหม่', 'cmu', 'builds cmu'] },
  { key: 'nia', kind: 'org', label: 'NIA', detect: /\bnia\b|สำนักงานนวัตกรรมแห่งชาติ/i, match: ['nia', 'สำนักงานนวัตกรรมแห่งชาติ'] },
  { key: 'tedfund', kind: 'org', label: 'TED Fund', detect: /ted ?fund|กองทุนพัฒนาผู้ประกอบการ/i, match: ['ted fund', 'tedfund', 'กองทุนพัฒนาผู้ประกอบการ'] },
]

/** Topics mentioned in a piece of text, with where the first match starts. */
export function detectTopics(text: string): { topic: Topic; index: number; length: number }[] {
  const out: { topic: Topic; index: number; length: number }[] = []
  for (const topic of TOPICS) {
    const m = text.match(topic.detect)
    if (m) out.push({ topic, index: m.index ?? 0, length: m[0].length })
  }
  return out
}

/** The topic a keyword stands for (by label, key or meaning), if any. */
export function topicOf(keyword: string): Topic | undefined {
  const k = keyword.trim().toLowerCase()
  return TOPICS.find((t) => t.label.toLowerCase() === k || t.key === k) ?? TOPICS.find((t) => t.detect.test(k))
}

// ------------------------------------------------------------------ event attributes

export const ATTRS = ['online', 'onsite', 'bangkok', 'abroad', 'free', 'prize'] as const
export type Attr = (typeof ATTRS)[number]
export const ATTR_LABEL: Record<Attr, string> = { online: 'ร่วมออนไลน์ได้', onsite: 'ออนไซต์', bangkok: 'กรุงเทพฯ', abroad: 'ต่างประเทศ', free: 'ฟรี', prize: 'รางวัลสูง' }
export const ATTR_DETECT: Record<Attr, RegExp> = {
  online: /ออนไลน์|online|remote|ทางไกล|ที่บ้าน/i,
  onsite: /ออนไซต์|onsite|on-site|ในสถานที่|ตัวต่อตัว/i,
  bangkok: /กรุงเทพ|กทม|bangkok|\bbkk\b/i,
  abroad: /ต่างประเทศ|ไปนอก|abroad|overseas|international trip|exchange|แลกเปลี่ยน/i,
  free: /ฟรี|\bfree\b|ไม่มีค่าใช้จ่าย|ไม่เสียเงิน|ไม่เสียค่า|fully funded/i,
  prize: /รางวัล(เยอะ|สูง|ใหญ่|เยอะๆ|เยอะ ๆ)|เงินรางวัล|prize|ชิงเงิน|รางวัลรวม|big prize/i,
}

const ABROAD_TEXT = /ต่างประเทศ|overseas|abroad|study tour|exchange program|กัวลาลัมเปอร์|kuala lumpur|singapore|สิงคโปร์|japan|ญี่ปุ่น|korea|เกาหลี|usa|united states|อเมริกา|europe|ยุโรป|china|จีน|taiwan|ไต้หวัน|australia|ออสเตรเลีย|\buk\b|london/i

type EventLike = { title: string; summary: string | null; overview: string | null; benefit: string | null; location: string | null; format: 'onsite' | 'online' | 'hybrid' | null; eligibility?: string | null }

/** Total prize in baht written in an event's text (largest amount found), or 0. */
export function prizeBaht(e: Pick<EventLike, 'benefit' | 'overview' | 'title'>): number {
  const text = `${e.benefit ?? ''} ${e.title} ${(e.overview ?? '').slice(0, 3000)}`
  let best = 0
  for (const m of text.matchAll(/(\d[\d,.]*)\s*(ล้าน)?\s*(บาท|฿|thb)/gi)) best = Math.max(best, parseFloat(m[1].replace(/,/g, '')) * (m[2] ? 1_000_000 : 1))
  // "$50,000", "$1.2M", "$5k", "USD 10,000" — the unit must touch the number ("$1 more" is $1).
  for (const m of text.matchAll(/(?:\$|usd\s?)(\d[\d,.]*)(\s?(?:million|mn)\b|[km]\b)?/gi)) {
    const unit = (m[2] ?? '').trim().toLowerCase()
    const mult = unit.startsWith('m') ? 1_000_000 : unit === 'k' ? 1000 : 1
    best = Math.max(best, parseFloat(m[1].replace(/,/g, '')) * mult * 35)
  }
  // Anything above 1,000 million baht is a parsing accident, not a student prize.
  return Number.isFinite(best) && best < 1e9 ? best : 0
}

export function hasAttr(e: EventLike, a: Attr): boolean {
  const text = `${e.title} ${e.summary ?? ''} ${(e.overview ?? '').slice(0, 4000)} ${e.benefit ?? ''}`
  switch (a) {
    case 'online':
      return e.format === 'online' || e.format === 'hybrid' || /ออนไลน์|online/i.test(e.location ?? '')
    case 'onsite':
      return e.format === 'onsite' || e.format === 'hybrid'
    case 'bangkok':
      return /กรุงเทพ|bangkok|กทม|จามจุรี|สยาม|ปทุมวัน|one bangkok/i.test(`${e.location ?? ''} ${text.slice(0, 1500)}`)
    case 'abroad':
      // Only clear signals: a foreign place in the title/summary/location, or a trip in the text.
      return ABROAD_TEXT.test(`${e.title} ${e.summary ?? ''} ${e.location ?? ''}`) || /เดินทางไป(ยัง)?(ประเทศ|ต่างประเทศ)|บินไป|ณ ประเทศ|ตั๋วเครื่องบิน|round-?trip|airfare|travel to/i.test(text)
    case 'free':
      return /ฟรี|\bfree\b|ไม่มีค่าใช้จ่าย|ไม่เสียค่าใช้จ่าย|ไม่มีค่าสมัคร|fully funded|ออกค่าใช้จ่ายให้/i.test(text) && !/ค่าสมัคร\s*\d/.test(text)
    case 'prize':
      return prizeBaht(e) >= 10_000
  }
}
