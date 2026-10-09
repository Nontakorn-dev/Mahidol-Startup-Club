import { z } from 'zod'

// Thai, field-aware messages for form validation (zod's defaults are English, e.g.
// "Too big: expected string to have <=30 characters").

const FIELD: Record<string, string> = {
  name: 'ชื่อทีมหรือชื่อโปรเจกต์',
  pitch: 'สรุปโปรเจกต์',
  details: 'รายละเอียด',
  contact: 'ช่องทางติดต่อ',
  skills: 'ทักษะ',
  event_text: 'ชื่อรายการแข่งขัน',
  members_count: 'จำนวนสมาชิกปัจจุบัน',
  target_size: 'จำนวนสมาชิกที่ต้องการ',
  roles_needed: 'ตำแหน่งที่ต้องการ',
  has_skills: 'ทักษะที่ทีมมีอยู่แล้ว',
  my_skills: 'ความเชี่ยวชาญของคุณ',
  seeking: 'ด้านของ Co-Founder',
  my_domain: 'ด้านที่เชี่ยวชาญ',
  seeking_domain: 'ด้านของผู้เชี่ยวชาญที่ต้องการ',
  about: 'ประสบการณ์โดยย่อ',
  idea_title: 'ชื่อโปรเจกต์',
  problem: 'ปัญหาที่ต้องการแก้ไข',
  commitment: 'เวลาที่สามารถทุ่มเทได้',
  portfolio_url: 'ลิงก์ผลงาน',
  first_name: 'ชื่อ',
  last_name: 'นามสกุล',
  headline: 'แนะนำตัวในหนึ่งบรรทัด',
  bio: 'เกี่ยวกับฉัน',
  label: 'ชื่อลิงก์',
  url: 'ลิงก์',
}

export function errMsg(err: unknown): string {
  if (!(err instanceof z.ZodError)) return (err as Error).message
  const issue = err.issues[0]
  // Messages we wrote ourselves are already Thai.
  if (/[฀-๿]/.test(issue.message)) return issue.message
  const key = [...issue.path].reverse().find((p) => typeof p === 'string') as string | undefined
  const field = (key && FIELD[key]) || 'ข้อมูล'
  const i = issue as unknown as { code: string; maximum?: number | bigint; minimum?: number | bigint; origin?: string }
  if (i.code === 'too_big') {
    if (i.origin === 'string') return `${field}ยาวเกินไป (ไม่เกิน ${i.maximum} ตัวอักษร)`
    if (i.origin === 'array') return `${field}เลือกได้ไม่เกิน ${i.maximum} รายการ`
    return `${field}ต้องไม่เกิน ${i.maximum}`
  }
  if (i.code === 'too_small') {
    if (i.origin === 'string') return `กรุณากรอก${field}`
    if (i.origin === 'array') return `กรุณาเลือก${field}อย่างน้อย ${i.minimum} รายการ`
    return `${field}ต้องไม่น้อยกว่า ${i.minimum}`
  }
  if (i.code === 'invalid_format') return `${field}ไม่ถูกต้อง`
  return `${field}ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง`
}

/** "React, Figma / Pitching" → ['React', 'Figma', 'Pitching'] — clipped, never rejected for length. */
export function splitTags(v: FormDataEntryValue | null, max: number, maxLen = 60): string[] {
  return String(v || '')
    .split(/[,，、;\n/|·]+/)
    .map((s) => s.trim().replace(/\s+/g, ' ').slice(0, maxLen).trim())
    .filter(Boolean)
    .filter((s, i, a) => a.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i)
    .slice(0, max)
}
