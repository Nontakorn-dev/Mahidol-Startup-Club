// Thai-locale formatting helpers (Buddhist-era dates, "อีก N วัน", display names).

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const TH_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

/** Today's date in Bangkok as YYYY-MM-DD. */
export function todayBangkok(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
}

function parseDateOnly(d: string) {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  return { y, m, day }
}

/** "30 พ.ย. 2569" */
export function thaiDate(d: string | null | undefined): string {
  if (!d) return '—'
  const { y, m, day } = parseDateOnly(d)
  return `${day} ${TH_MONTHS[m - 1]} ${y + 543}`
}

/** "วันพุธที่ 7 ต.ค. 2569" */
export function thaiLongToday(): string {
  const t = todayBangkok()
  const { y, m, day } = parseDateOnly(t)
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay()
  return `วัน${TH_DAYS[dow]}ที่ ${day} ${TH_MONTHS[m - 1]} ${y + 543}`
}

/** Whole days from today (Bangkok) until the given date. Negative when past. */
export function daysUntil(d: string): number {
  const a = parseDateOnly(todayBangkok())
  const b = parseDateOnly(d)
  return Math.round((Date.UTC(b.y, b.m - 1, b.day) - Date.UTC(a.y, a.m - 1, a.day)) / 86_400_000)
}

// ------------------------------------------------------------------ deadlines (exact closing time)

/** A deadline: a date string (closes 23:59:59 Bangkok time), or an event row with an exact `deadline_at`. */
export type Deadline = string | null | undefined | { deadline: string | null; deadline_at?: string | null }

const BKK_OFFSET_MS = 7 * 3_600_000

/** The exact moment applications close. Date-only deadlines close at 23:59:59 Asia/Bangkok. */
export function closesAt(d: Deadline): Date | null {
  if (!d) return null
  if (typeof d === 'object') {
    if (d.deadline_at) return new Date(d.deadline_at)
    return closesAt(d.deadline)
  }
  if (d.length > 10) return new Date(d)
  const { y, m, day } = parseDateOnly(d)
  return new Date(Date.UTC(y, m - 1, day, 23, 59, 59) - BKK_OFFSET_MS)
}

export function msLeft(d: Deadline, now = Date.now()): number | null {
  const c = closesAt(d)
  return c ? c.getTime() - now : null
}

export function isClosed(d: Deadline, now = Date.now()): boolean {
  const ms = msLeft(d, now)
  return ms !== null && ms <= 0
}

/** Bangkok calendar date (YYYY-MM-DD) of the closing moment. */
function closingDate(d: Deadline): string | null {
  const c = closesAt(d)
  return c ? new Date(c.getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10) : null
}

/** "20:00 น." — or null when the deadline is the default end of day. */
export function closingTime(d: Deadline): string | null {
  const c = closesAt(d)
  if (!c) return null
  const t = new Date(c.getTime() + BKK_OFFSET_MS).toISOString().slice(11, 16)
  return t === '23:59' ? null : `${t} น.`
}

/** "12 ต.ค. 2569 เวลา 20:00 น." */
export function thaiDeadline(d: Deadline): string {
  const date = closingDate(d)
  if (!date) return '—'
  const t = closingTime(d)
  return t ? `${thaiDate(date)} เวลา ${t}` : thaiDate(date)
}

/** "อีก 3 วัน" · "อีก 5 ชม." · "อีก 12 นาที" · "ปิดรับแล้ว" */
export function timeLeftLabel(ms: number | null): string {
  if (ms === null) return 'เปิดรับอยู่'
  if (ms <= 0) return 'ปิดรับแล้ว'
  const min = Math.ceil(ms / 60_000)
  if (min < 60) return `อีก ${min} นาที`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `อีก ${hours} ชม. ${min % 60 ? `${min % 60} นาที` : ''}`.trim()
  const days = Math.floor(hours / 24)
  return days < 3 ? `อีก ${days} วัน ${hours % 24} ชม.` : `อีก ${days} วัน`
}

export type Urgency = 'none' | 'closed' | 'today' | 'soon' | 'week' | 'normal'

/** today = closes within 24 h · soon = ≤ 3 days · week = ≤ 7 days */
export function urgency(d: Deadline, now = Date.now()): Urgency {
  const ms = msLeft(d, now)
  if (ms === null) return 'none'
  if (ms <= 0) return 'closed'
  if (ms <= 86_400_000) return 'today'
  if (ms <= 3 * 86_400_000) return 'soon'
  if (ms <= 7 * 86_400_000) return 'week'
  return 'normal'
}

/** Line under an event title: "ปิดรับ 30 พ.ย. 2569 · อีก 54 วัน" / "ปิดรับวันนี้ 20:00 น." / "ปิดรับเมื่อ 15 มี.ค. 2569" */
export function deadlineLine(d: Deadline, openNote?: string | null): string {
  const ms = msLeft(d)
  if (ms === null) return openNote || 'เปิดรับสมัครอยู่'
  if (ms <= 0) return `ปิดรับเมื่อ ${thaiDate(closingDate(d))}`
  const date = closingDate(d)!
  const t = closingTime(d)
  if (date === todayBangkok()) return `ปิดรับวันนี้ ${t ?? '23:59 น.'} · ${timeLeftLabel(ms)}`
  return `ปิดรับ ${thaiDeadline(d)} · ${timeLeftLabel(ms)}`
}

/** "10:42" today, "เมื่อวาน", weekday this week, else "3 ต.ค." */
export function chatTime(iso: string): string {
  const date = new Date(iso)
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', ...o }).format(date)
  const day = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' })
  const diff = -daysUntil(day)
  if (diff <= 0) return fmt({ hour: '2-digit', minute: '2-digit', hour12: false })
  if (diff === 1) return 'เมื่อวาน'
  const { y, m, day: dd } = parseDateOnly(day)
  if (diff < 7) return TH_DAYS_SHORT[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]
  return `${dd} ${TH_MONTHS[m - 1]}`
}

/** "วันนี้ 10:42" style used in admin tables. */
export function adminTime(iso: string): string {
  const t = chatTime(iso)
  return /^\d/.test(t) && t.includes(':') ? `วันนี้ ${t}` : t
}

export function dayLabel(iso: string): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(iso))
  const diff = -daysUntil(day)
  if (diff <= 0) return 'วันนี้'
  if (diff === 1) return 'เมื่อวาน'
  return thaiDate(day)
}

/** "พิมพ์ชนก ส." — first name plus last-name initial, as on the design cards. */
export function shortName(first?: string | null, last?: string | null): string {
  const f = (first || '').trim()
  const l = (last || '').trim()
  if (!f && !l) return 'สมาชิก'
  return l ? `${f} ${Array.from(l)[0]}.` : f
}

export function initialOf(name?: string | null): string {
  const s = (name || '').trim()
  return s ? Array.from(s)[0].toUpperCase() : '?'
}

export function facultyLine(faculty?: string | null, year?: string | null): string {
  return [faculty, year].filter(Boolean).join(' · ') || 'Mahidol Startup Club'
}

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9ก-๙]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'event'
}

export function hostOf(url?: string | null): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}
