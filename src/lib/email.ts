import 'server-only'
import { createHash } from 'node:crypto'
import { env, serverEnv } from '@/lib/env'
import { signPayload } from '@/lib/crypto'
import { absoluteUrl, type NoticeContent } from '@/lib/line/messaging'

// ------------------------------------------------------------------ template

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const nl2br = (s: string) => esc(s).replace(/\n/g, '<br>')

const FONT = "'IBM Plex Sans Thai','Sarabun','Leelawadee UI',Tahoma,Helvetica,Arial,sans-serif"
const C = { navy: '#10233F', brand: '#0035AD', muted: '#64748B', bg: '#F4F7FC', line: '#E6ECF8', yellow: '#FFC726', soft: '#FFF6D6' }

export function unsubscribeUrl(userId: string) {
  return `${env.siteUrl}/unsubscribe?t=${encodeURIComponent(signPayload({ u: userId, k: 'unsub' }))}`
}
export function oneClickUnsubscribeUrl(userId: string) {
  return `${env.siteUrl}/api/email/unsubscribe?t=${encodeURIComponent(signPayload({ u: userId, k: 'unsub' }))}`
}

function button(label: string, href: string) {
  // "Bulletproof" button: renders in Outlook, Gmail and mobile clients alike.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px"><tr>
<td bgcolor="${C.brand}" style="border-radius:12px">
<a href="${esc(href)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:12px">${esc(label)} &rarr;</a>
</td></tr></table>`
}

/** Branded notification email (Thai), with preheader and per-recipient unsubscribe links. */
export function renderNoticeEmail(c: NoticeContent, opts: { unsubscribeUrl?: string } = {}): { html: string; text: string } {
  const img = absoluteUrl(c.imageUrl)
  const uris = c.actions.filter((a) => a.type === 'uri') as { label: string; url: string }[]
  const [primary, ...secondary] = uris
  const preheader = (c.subtitle || c.quote || c.title).replace(/\s+/g, ' ').slice(0, 140)
  const settings = `${env.siteUrl}/settings/notifications`

  const html = `<!doctype html>
<html lang="th" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(c.altText)}</title>
<style>
  @media (max-width:600px){ .card{border-radius:0!important} .px{padding-left:22px!important;padding-right:22px!important} .h1{font-size:21px!important} }
  a{color:${C.brand}}
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg}">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg}">
<tr><td align="center" style="padding:28px 12px">
  <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid ${C.line}">
    <tr><td class="px" style="padding:22px 32px;border-bottom:1px solid ${C.line}">
      <a href="${env.siteUrl}" target="_blank"><img src="${env.siteUrl}/assets/logo-2026.png" width="150" height="45" alt="Mahidol Startup Club" style="display:block;border:0;height:45px;width:auto"></a>
    </td></tr>
    ${c.headerBar ? `<tr><td class="px" bgcolor="${C.brand}" style="padding:12px 32px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff">${esc(c.headerBar)}</td></tr>` : ''}
    ${img ? `<tr><td><img src="${esc(img)}" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;border:0"></td></tr>` : ''}
    <tr><td class="px" style="padding:28px 32px 30px;font-family:${FONT};color:${C.navy}">
      ${c.badge ? `<span style="display:inline-block;padding:3px 12px;border-radius:999px;background:${C.yellow};font-size:12px;font-weight:600;color:${C.navy}">${esc(c.badge)}</span>` : ''}
      ${c.person ? `<p style="margin:${c.badge ? '14px' : '0'} 0 0;font-size:14px;line-height:21px"><b>${esc(c.person.name)}</b>${c.person.sub ? `<span style="color:${C.muted}"> · ${esc(c.person.sub)}</span>` : ''}</p>` : ''}
      <h1 class="h1" style="margin:${c.badge || c.person ? '12px' : '0'} 0 10px;font-size:23px;line-height:32px;font-weight:600;color:${C.navy}">${esc(c.title)}</h1>
      ${c.subtitle ? `<p style="margin:0 0 6px;font-size:15px;line-height:24px;color:${C.muted}">${nl2br(c.subtitle)}</p>` : ''}
      ${c.quote ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 4px"><tr><td style="padding:14px 16px;border-radius:12px;background:${C.soft};font-size:15px;line-height:24px;color:${C.navy}">“${nl2br(c.quote)}”</td></tr></table>` : ''}
      ${primary ? button(primary.label, absoluteUrl(primary.url)!) : ''}
      ${secondary.map((a) => `<p style="margin:10px 0 0;font-size:14px"><a href="${esc(absoluteUrl(a.url)!)}" style="color:${C.brand}">${esc(a.label)}</a></p>`).join('')}
    </td></tr>
    <tr><td class="px" style="padding:18px 32px 24px;border-top:1px solid ${C.line};font-family:${FONT};font-size:12px;line-height:19px;color:${C.muted}">
      Mahidol Startup Club · ชมรมสตาร์ตอัพมหาวิทยาลัยมหิดล สนับสนุนโดย iNT มหาวิทยาลัยมหิดล<br>
      อยากรับข่าวสารทาง LINE แทน? <a href="${settings}#line" style="color:${C.brand}">เชื่อม LINE</a> ·
      <a href="${settings}" style="color:${C.brand}">ตั้งค่าการแจ้งเตือน</a>${opts.unsubscribeUrl ? ` · <a href="${esc(opts.unsubscribeUrl)}" style="color:${C.muted}">ยกเลิกรับอีเมล</a>` : ''}
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`

  const text = [
    c.headerBar,
    c.title,
    c.subtitle,
    c.quote && `“${c.quote}”`,
    ...uris.map((a) => `${a.label}: ${absoluteUrl(a.url)}`),
    '—',
    `ตั้งค่าการแจ้งเตือน: ${settings}`,
    opts.unsubscribeUrl && `ยกเลิกรับอีเมล: ${opts.unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  return { html, text }
}

// ------------------------------------------------------------------ sending (Resend batch API)

export type Mail = { to: string; subject: string; html: string; text?: string; headers?: Record<string, string> }
export type SendResult = { sent: number; failed: number; retryable: boolean; quotaExceeded?: 'daily' | 'monthly'; error?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let lastCall = 0
// Resend's default limit is 10 requests/second per team; stay comfortably under it.
const MIN_GAP_MS = 150

/**
 * Send up to 100 emails in one Resend batch call. Handles 429 (rate limit → wait and retry;
 * quota → report so the outbox pauses) and uses an idempotency key so retries never double-send.
 */
export async function sendBatch(mails: Mail[], idempotencyKey?: string): Promise<SendResult> {
  const { resendKey, emailFrom } = serverEnv()
  if (!resendKey) return { sent: 0, failed: mails.length, retryable: false, error: 'RESEND_API_KEY not set' }
  if (!mails.length) return { sent: 0, failed: 0, retryable: false }
  if (mails.length > 100) throw new Error('sendBatch: max 100 emails per call')
  const key = idempotencyKey ?? createHash('sha256').update(mails.map((m) => `${m.to}|${m.subject}`).join('\n')).digest('hex').slice(0, 64)

  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = lastCall + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastCall = Date.now()
    let res: Response
    try {
      res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(
          mails.map((m) => ({ from: emailFrom, to: [m.to], subject: m.subject, html: m.html, text: m.text, headers: m.headers })),
        ),
      })
    } catch (err) {
      if (attempt < 3) {
        await sleep(500 * 2 ** attempt)
        continue
      }
      return { sent: 0, failed: mails.length, retryable: true, error: String(err) }
    }
    if (res.ok) return { sent: mails.length, failed: 0, retryable: false }
    const body = await res.text()
    if (res.status === 429) {
      if (/daily_quota/i.test(body)) return { sent: 0, failed: mails.length, retryable: true, quotaExceeded: 'daily', error: body.slice(0, 200) }
      if (/monthly_quota/i.test(body)) return { sent: 0, failed: mails.length, retryable: true, quotaExceeded: 'monthly', error: body.slice(0, 200) }
      const retryAfter = Number(res.headers.get('retry-after') || res.headers.get('ratelimit-reset') || 1)
      await sleep(Math.min(10, Math.max(1, retryAfter)) * 1000)
      continue
    }
    if (res.status === 409) return { sent: mails.length, failed: 0, retryable: false } // same idempotency key already sent
    return { sent: 0, failed: mails.length, retryable: res.status >= 500, error: `${res.status} ${body.slice(0, 200)}` }
  }
  return { sent: 0, failed: mails.length, retryable: true, error: 'rate limited' }
}
