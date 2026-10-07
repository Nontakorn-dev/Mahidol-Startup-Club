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

export function isClosed(deadline: string | null | undefined): boolean {
  return Boolean(deadline) && daysUntil(deadline!) < 0
}

/** Line under an event title: "ปิดรับ 30 พ.ย. 2569 · อีก 54 วัน" / "ปิดรับเมื่อ 15 มี.ค. 2569" */
export function deadlineLine(deadline: string | null, openNote?: string | null): string {
  if (!deadline) return openNote || 'เปิดรับสมัครอยู่'
  const n = daysUntil(deadline)
  if (n < 0) return `ปิดรับเมื่อ ${thaiDate(deadline)}`
  if (n === 0) return `ปิดรับวันนี้ (${thaiDate(deadline)})`
  return `ปิดรับ ${thaiDate(deadline)} · อีก ${n} วัน`
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
