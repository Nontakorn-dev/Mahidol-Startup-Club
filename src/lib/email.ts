import 'server-only'
import { env, serverEnv } from '@/lib/env'
import { absoluteUrl, type NoticeContent } from '@/lib/line/messaging'

// Email fallback for users who have not linked LINE (Resend REST API).

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function noticeEmailHtml(c: NoticeContent, footerNote?: string): string {
  const img = absoluteUrl(c.imageUrl)
  const uriActions = c.actions.filter((a) => a.type === 'uri') as { label: string; url: string }[]
  const primary = uriActions[0]
  return `<!doctype html><html lang="th"><body style="margin:0;background:#F4F7FC;font-family:'IBM Plex Sans Thai',Tahoma,sans-serif;color:#10233F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FC;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:18px;overflow:hidden">
<tr><td style="padding:18px 24px;border-bottom:1px solid #EEF2F8"><img src="${env.siteUrl}/assets/logo.png" alt="Mahidol Startup Club" height="40" style="height:40px"></td></tr>
${c.headerBar ? `<tr><td style="background:#0035AD;color:#FFFFFF;padding:10px 24px;font-weight:600;font-size:14px">${esc(c.headerBar)}</td></tr>` : ''}
${img ? `<tr><td><img src="${img}" alt="" width="520" style="display:block;width:100%;max-height:300px;object-fit:cover"></td></tr>` : ''}
<tr><td style="padding:22px 24px">
${c.badge ? `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:#FFC726;font-size:12px;font-weight:600">${esc(c.badge)}</span>` : ''}
${c.person ? `<p style="margin:10px 0 0;font-size:14px;font-weight:600">${esc(c.person.name)}${c.person.sub ? ` <span style="font-weight:400;color:#64748B">· ${esc(c.person.sub)}</span>` : ''}</p>` : ''}
<h1 style="margin:10px 0 6px;font-size:20px;line-height:1.35">${esc(c.title)}</h1>
${c.subtitle ? `<p style="margin:0 0 8px;font-size:14px;color:#64748B;white-space:pre-line">${esc(c.subtitle)}</p>` : ''}
${c.quote ? `<p style="margin:0 0 8px;font-size:14px">“${esc(c.quote)}”</p>` : ''}
${primary ? `<p style="margin:18px 0 0"><a href="${absoluteUrl(primary.url)}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#0035AD;color:#FFFFFF;text-decoration:none;font-weight:600">${esc(primary.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #EEF2F8;font-size:12px;color:#64748B">${esc(footerNote || 'คุณได้รับอีเมลนี้เพราะเป็นสมาชิก Mahidol Startup Club')} · <a href="${env.siteUrl}/settings/notifications" style="color:#0035AD">ตั้งค่าการแจ้งเตือน</a> · เชื่อม LINE เพื่อรับแจ้งเตือนทาง LINE แทน</td></tr>
</table></td></tr></table></body></html>`
}

export function noticeEmailText(c: NoticeContent): string {
  const primary = c.actions.find((a) => a.type === 'uri') as { url: string } | undefined
  return [c.headerBar, c.title, c.subtitle, c.quote && `“${c.quote}”`, primary && absoluteUrl(primary.url)]
    .filter(Boolean)
    .join('\n\n')
}

type Mail = { to: string; subject: string; html: string; text?: string }

export async function sendEmails(mails: Mail[]): Promise<{ sent: number; failed: number }> {
  const { resendKey, emailFrom } = serverEnv()
  if (!resendKey || !mails.length) return { sent: 0, failed: mails.length }
  let sent = 0
  let failed = 0
  // Resend batch endpoint accepts up to 100 emails per call.
  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100)
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk.map((m) => ({ from: emailFrom, to: [m.to], subject: m.subject, html: m.html, text: m.text }))),
    })
    if (res.ok) sent += chunk.length
    else {
      failed += chunk.length
      console.error('Resend batch failed', res.status, (await res.text()).slice(0, 300))
    }
  }
  return { sent, failed }
}
