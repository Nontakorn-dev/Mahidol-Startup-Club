import type { Category, Role } from '@/lib/constants'
import { cleanValue } from './text'
import type { Level, SourceItem } from './types'

/** What an approved import becomes in `events` (stored as event_imports.mapped). */
export type MappedEvent = {
  title: string
  category: Category
  organizer: string | null
  summary: string | null
  benefit: string | null
  eligibility: string | null
  overview: string | null
  apply_url: string | null
  deadline: string | null
  deadline_at: string | null
  event_start: string | null
  event_end: string | null
  location: string | null
  format: 'onsite' | 'online' | 'hybrid' | null
  poster_url: string | null
  tags: Role[]
  source: string
  source_url: string
  matched: string[]
}

const LEVEL_TEXT: Record<Level, string> = { university: 'นักศึกษา', public: 'บุคคลทั่วไป', high_school: 'นักเรียน ม.ปลาย' }

export function mapToEvent(source: string, it: SourceItem, matched: string[], levels: Level[]): MappedEvent {
  const description = cleanValue(it.description)?.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n') ?? ''
  const text = `${it.title} ${description} ${(it.hints ?? []).join(' ')}`

  let category: Category = /workshop|camp|ค่าย|เวิร์[กค]ช็อป|bootcamp|อบรม|training/i.test(`${it.source_type} ${it.title}`) ? 'workshop' : 'competition'
  if (/incubat|accelerat|บ่มเพาะ|ยุววิสาหกิจ|ideation program/i.test(text)) category = 'incubation'
  else if (/\bgrant\b|ทุนสนับสนุน|ทุนพัฒนา|fully funded|scholarship|ทุนการศึกษา/i.test(it.title)) category = 'grant'

  const tags = new Set<Role>()
  if (/business|ธุรกิจ|case|marketing|การตลาด|pitch|entrepreneur|ผู้ประกอบการ|startup|สตาร์|fintech|commerce/i.test(text)) tags.add('business')
  if (/marketing|การตลาด|content|branding/i.test(text)) tags.add('marketing')
  if (/hackathon|develop|code|coding|software|\bapp\b|codex|programming|โปรแกรม/i.test(text)) tags.add('developer')
  if (/\bai\b|data|machine learning|ปัญญาประดิษฐ์/i.test(text)) tags.add('data_ai')
  if (/design|ux|ui|ออกแบบ/i.test(text)) tags.add('ux_ui')
  if (/hardware|iot|robot|energy|พลังงาน|embedded/i.test(text)) tags.add('hardware')
  if (/health|การแพทย์|สุขภาพ|medic|เภสัช|แพทย์/i.test(text)) tags.add('domain_expert')

  const firstLine = description.split('\n').map((s) => s.replace(/^[•\-–\s]+/, '').trim()).find((s) => s.length > 15) ?? ''
  const summary = firstLine.length > 110 ? `${firstLine.slice(0, 107)}…` : firstLine
  const eligibility = cleanValue(it.eligibility) ?? levels.map((l) => LEVEL_TEXT[l]).join(' / ')

  return {
    title: it.title.slice(0, 120),
    category,
    organizer: cleanValue(it.organizer)?.slice(0, 80) ?? null,
    summary: summary || null,
    benefit: cleanValue(it.prize)?.slice(0, 80) ?? null,
    eligibility: eligibility ? eligibility.slice(0, 60) : null,
    overview: description.slice(0, 6000) || null,
    apply_url: it.apply_url || it.source_url,
    deadline: it.deadline,
    deadline_at: it.deadline_at,
    event_start: it.event_start && it.event_start !== it.deadline ? it.event_start : null,
    event_end: it.event_end && it.event_end !== it.deadline ? it.event_end : null,
    location: cleanValue(it.location)?.slice(0, 80) ?? null,
    format: it.format,
    poster_url: it.poster_url,
    tags: [...tags],
    source,
    source_url: it.source_url,
    matched,
  }
}
