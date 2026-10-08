// First line of defence for the search box (web + LINE), before anything costs a model call.
//  • cleans the text (control / zero-width chars, length) and masks personal data
//  • rejects empty, gibberish, abusive or clearly off-topic input with a friendly message
// The model is a second line: it also labels input as off-topic / unsafe, and its output is
// restricted to our filter vocabulary, so "ignore your instructions…" can't change what it does.

export type GuardResult =
  | { ok: true; text: string }
  | { ok: false; kind: 'empty' | 'gibberish' | 'blocked' | 'off_topic' | 'too_long'; message: string }

export const MAX_QUERY_CHARS = 200

const ABUSIVE = [
  /\b(fuck|f\*ck|shit|bitch|cunt|dick|pussy|porn|nude|nudes|xxx|onlyfans|nigg)/i,
  /เย็ด|ควย|เงี่ยน|จิ๋ม|แตด|ร่วมเพศ|คลิปหลุด|หนังโป๊|โป๊|อีดอก|อีสัส|ไอ้สัส|สัสหมา|ไอ้เหี้ย|อีเหี้ย|พ่อมึงตาย|แม่มึงตาย/,
]
const HARMFUL = [
  /ยาเสพติด|ยาบ้า|โคเคน|กัญชา.*ขาย|ซื้อปืน|ขายปืน|ระเบิด.*(ทำ|สร้าง)|ฆ่า(ตัวตาย|คน)|แฮก(เฟส|ไอจี|บัญชี|รหัส)|hack (an? )?(account|facebook|instagram)|ปลอมเอกสาร|บัตรปลอม|พนันออนไลน์|เว็บพนัน|บาคาร่า|สล็อต/i,
  /\b(cocaine|meth|buy (a )?gun|make (a )?bomb|kill (myself|someone)|casino|gambling|betting)\b/i,
]
// Prompt-injection / using the box as a general chatbot.
const OFF_TOPIC = [
  /ignore (all |any )?(previous|prior|above)|system prompt|you are now|jailbreak|developer mode|ลืมคำสั่ง|เพิกเฉยคำสั่ง|คำสั่งก่อนหน้า/i,
  /^(สวัสดี(ครับ|ค่ะ|คะ)?|หวัดดี|ดีจ้า|hello|hi|hey|ขอบคุณ(ครับ|ค่ะ)?|thank(s| you)|ok|โอเค|test|ทดสอบ)[!.\s]*$/i,
  /ทำการบ้าน|เขียนเรียงความ|แปลภาษา|แต่งกลอน|ดูดวง|หวย|เลขเด็ด|สูตรอาหาร|วิธีทำอาหาร|พยากรณ์อากาศ|ราคาทอง|ราคาหุ้น|write (me )?an? (essay|poem|story)|translate this/i,
]

const MSG = {
  empty: 'พิมพ์สิ่งที่อยากทำได้เลย เช่น “หาทีมลง hackathon ฉันทำ UX ได้ ขาด dev”',
  gibberish: 'ยังไม่เข้าใจข้อความนี้ ลองพิมพ์เป็นประโยค เช่น “อยากหาทุนทำสตาร์ตอัพสายสุขภาพ”',
  blocked: 'ข้อความนี้ใช้ค้นหาไม่ได้ ช่องนี้ใช้หางานแข่ง ทุน ทีม และ co-founder เท่านั้น',
  off_topic: 'ช่องนี้ช่วยหางานแข่ง ทุน ทีม และ co-founder ลองพิมพ์ เช่น “หาทีมลง TED Youth” หรือ “ทุนสตาร์ตอัพที่ปิดรับเดือนนี้”',
  too_long: `ข้อความยาวเกินไป ลองสรุปให้สั้นลง (ไม่เกิน ${MAX_QUERY_CHARS} ตัวอักษร)`,
}

/** Remove things that must never reach a third-party model (phone, e-mail, ID, links). */
function maskPersonal(s: string) {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b\d{1}[-\s]?\d{4}[-\s]?\d{5}[-\s]?\d{2}[-\s]?\d{1}\b/g, ' ') // Thai ID
    .replace(/(\+?66|0)[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{4}\b/g, ' ') // phone
}

function looksLikeGibberish(s: string) {
  const letters = s.replace(/[^\p{L}]/gu, '')
  if (letters.length < 2) return true
  if (/(.)\1{5,}/u.test(s)) return true // "aaaaaa", "5555555"
  // Long latin runs without vowels: "sdfghjkl", "qwrtyp"
  if ((s.match(/[a-z]{6,}/gi) || []).some((w) => !/[aeiouy]/i.test(w))) return true
  return false
}

export function guardQuery(input: string): GuardResult {
  const text = maskPersonal(
    (input || '')
      .normalize('NFC')
      .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, ' ')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return { ok: false, kind: 'empty', message: MSG.empty }
  if (text.length > MAX_QUERY_CHARS * 1.5) return { ok: false, kind: 'too_long', message: MSG.too_long }
  if (ABUSIVE.some((re) => re.test(text)) || HARMFUL.some((re) => re.test(text))) return { ok: false, kind: 'blocked', message: MSG.blocked }
  if (OFF_TOPIC.some((re) => re.test(text))) return { ok: false, kind: 'off_topic', message: MSG.off_topic }
  if (looksLikeGibberish(text)) return { ok: false, kind: 'gibberish', message: MSG.gibberish }
  return { ok: true, text: text.slice(0, MAX_QUERY_CHARS) }
}

export const GUARD_MESSAGES = MSG
