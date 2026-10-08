import type { Level, SourceItem } from './types'

// Which listings are worth an admin's time: startup · นวัตกรรม · workshop · ธุรกิจ, open to
// university students (or anyone). High-school-only listings are dropped outright.

const STRONG: Record<string, RegExp> = {
  startup: /start-?up|สตาร์[ทต]อัพ|ยุววิสาหกิจ|founder/i,
  ผู้ประกอบการ: /entrepreneur|ผู้ประกอบการ|venture/i,
  ธุรกิจ: /business|ธุรกิจ|case competition|case challenge|การตลาด|marketing|e-?commerce|fintech/i,
  นวัตกรรม: /innovat|นวัตกรรม/i,
  pitch: /pitch|ideation|ideathon|business plan|แผนธุรกิจ/i,
  บ่มเพาะ: /incubat|accelerat|บ่มเพาะ|ted fund|ted youth/i,
}
const MEDIUM: Record<string, RegExp> = {
  workshop: /workshop|bootcamp|เวิร์[กค]ช็อป|ค่าย|\bcamp\b/i,
  hackathon: /hackathon|แฮกกาธอน|game jam/i,
  'AI/Tech': /\bai\b|artificial intelligence|ปัญญาประดิษฐ์|digital|deep ?tech|machine learning|\bdata\b|software|\bapp\b|codex|blockchain/i,
  สุขภาพ: /health|สุขภาพ|การแพทย์|medic/i,
  ความยั่งยืน: /sustainab|\besg\b|green|climate|social good|social impact|ความยั่งยืน/i,
}
const OFF_TOPIC = /film|ภาพยนตร์|short film|หนังสั้น|chair design|furniture|story contest|video competition|ประกวดร้องเพลง|ดนตรี|วงดนตรี|ถ่ายภาพ|photograph|วาดภาพ|painting|volunteer|อาสา|leadership summit|beauty|นางงาม|ติวสอบ|tcas|open ?house|เปิดบ้าน/i
export const RELEVANCE_THRESHOLD = 4

const UNI = /นักศึกษา|นิสิต|ปริญญาตรี|ปริญญาโท|อุดมศึกษา|มหาวิทยาลัย|university|undergrad|college|bachelor|ป\.ตรี|ปวส/i
const PUBLIC = /บุคคลทั่วไป|ประชาชนทั่วไป|ไม่จำกัดอายุ|ทุกเพศทุกวัย|open to all|anyone|ผู้ที่สนใจ/i
const HIGH = /มัธยม|ม\.ปลาย|ม\.ต้น|ม\.[1-6]|นักเรียน|high ?school|secondary school/i

/** Levels from the source, else guessed from the eligibility/description text. */
export function levelsOf(it: Pick<SourceItem, 'levels' | 'eligibility' | 'description' | 'title'>): Level[] {
  if (it.levels.length) return it.levels
  const text = `${it.title}\n${it.eligibility ?? ''}\n${(it.description ?? '').slice(0, 1500)}`
  const out: Level[] = []
  if (UNI.test(text)) out.push('university')
  if (PUBLIC.test(text)) out.push('public')
  if (HIGH.test(text)) out.push('high_school')
  return out
}

/** Why a listing stays out of the review queue, or null when it should go in. */
export function skipReason(it: SourceItem, score: number, today: string): string | null {
  if (it.skip) return it.skip
  if (it.deadline && it.deadline < today) return 'เลยวันปิดรับแล้ว'
  if (it.deadline_at && Date.parse(it.deadline_at) <= Date.now()) return 'ปิดรับสมัครแล้ว'
  if (!it.open) return 'ปิดรับสมัครแล้ว'
  if (score === -99) return 'รับเฉพาะนักเรียน ม.ปลาย'
  if (score < RELEVANCE_THRESHOLD) return `ไม่ตรงสาย startup/ธุรกิจ/นวัตกรรม (คะแนน ${score})`
  return null
}

export function scoreRelevance(it: SourceItem): { score: number; matched: string[]; levels: Level[] } {
  const levels = levelsOf(it)
  if (levels.length && !levels.includes('university') && !levels.includes('public')) {
    return { score: -99, matched: ['ม.ปลายเท่านั้น'], levels }
  }
  const title = `${it.title} ${it.organizer ?? ''} ${(it.hints ?? []).join(' ')}`
  const body = `${it.description ?? ''} ${it.prize ?? ''}`
  let score = it.typeBonus ?? 0
  const matched: string[] = []
  for (const [k, re] of Object.entries(STRONG)) {
    if (re.test(title)) (score += 4), matched.push(k)
    else if (re.test(body)) (score += 2), matched.push(k)
  }
  for (const [k, re] of Object.entries(MEDIUM)) {
    if (re.test(title)) (score += 2), matched.push(k)
    else if (re.test(body)) (score += 1), matched.push(k)
  }
  if (OFF_TOPIC.test(it.title)) (score -= 5), matched.push('อาจไม่ตรงสาย')
  if (levels.includes('university')) matched.push('ระดับมหาวิทยาลัย')
  return { score, matched, levels }
}
