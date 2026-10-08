import { closesAt } from '@/lib/format'
import { env } from '@/lib/env'
import type { EventRow } from '@/lib/types'

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** A 30-minute calendar block ending at the real closing time: "ปิดรับสมัคร: <title>". */
function block(e: EventRow) {
  const end = closesAt(e)!
  return { start: new Date(end.getTime() - 30 * 60_000), end }
}

export function googleCalendarUrl(e: EventRow): string {
  const { start, end } = block(e)
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `ปิดรับสมัคร: ${e.title}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: `สมัครก่อนปิดรับ\n${env.siteUrl}/opportunities/${e.slug}${e.apply_url ? `\nลิงก์สมัคร: ${e.apply_url}` : ''}`,
    ctz: 'Asia/Bangkok',
  })
  return `https://calendar.google.com/calendar/render?${q}`
}

const icsEscape = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')

/** iCalendar file with reminders 3 days and 3 hours before closing. */
export function eventIcs(e: EventRow): string {
  const { start, end } = block(e)
  const url = `${env.siteUrl}/opportunities/${e.slug}`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mahidol Startup Club//Deadlines//TH',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:deadline-${e.id}@mahidol-startup-club`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${icsEscape(`ปิดรับสมัคร: ${e.title}`)}`,
    `DESCRIPTION:${icsEscape(`${url}${e.apply_url ? `\nลิงก์สมัคร: ${e.apply_url}` : ''}`)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'TRIGGER:-P3D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(`อีก 3 วันปิดรับ ${e.title}`)}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT3H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(`อีก 3 ชั่วโมงปิดรับ ${e.title}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
