// Applies the production Auth settings to the Supabase project in one call (Management API).
//
// Usage:  node --env-file=.env.local scripts/configure-supabase-auth.mjs
// Needs in .env.local (never commit):
//   SUPABASE_ACCESS_TOKEN   personal access token — supabase.com/dashboard/account/tokens
// Optional:
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   → enables "Continue with Google"
//   RESEND_SMTP_KEY (falls back to RESEND_API_KEY) → Supabase sends auth emails through Resend
//   SMTP_SENDER (default noreply@mahidolstartup.site)
import { readFileSync } from 'node:fs'

const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN in .env.local first (https://supabase.com/dashboard/account/tokens).')
  process.exit(1)
}
const site = (process.env.AUTH_SITE_URL || 'https://mahidol-startup-club.vercel.app').replace(/\/$/, '')
const tpl = (name) => readFileSync(new URL(`../supabase/email-templates/${name}.html`, import.meta.url), 'utf8')

const config = {
  site_url: site,
  uri_allow_list: [`${site}/**`, 'https://mahidolstartup.site/**', 'https://www.mahidolstartup.site/**', 'http://localhost:3000/**'].join(','),
  // Per-IP limits must see the visitor's IP when Next.js calls Auth from the server.
  security_sb_forwarded_for_enabled: true,
  // Project-wide hourly caps (custom SMTP only). Real ceiling = your Resend plan.
  rate_limit_email_sent: 2000,
  rate_limit_otp: 2000,
  mailer_otp_length: 6,
  mailer_subjects_magic_link: 'รหัสเข้าสู่ระบบ Mahidol Startup Club: {{ .Token }}',
  mailer_templates_magic_link_content: tpl('magic_link'),
  mailer_subjects_confirmation: 'ยืนยันอีเมล Mahidol Startup Club: {{ .Token }}',
  mailer_templates_confirmation_content: tpl('confirmation'),
  mailer_subjects_email_change: 'ยืนยันอีเมลใหม่ — Mahidol Startup Club',
  mailer_templates_email_change_content: tpl('email_change'),
  mailer_subjects_recovery: 'รหัสเข้าสู่ระบบ Mahidol Startup Club: {{ .Token }}',
  mailer_templates_recovery_content: tpl('recovery'),
}

const smtpKey = process.env.RESEND_SMTP_KEY || process.env.RESEND_API_KEY
if (smtpKey) {
  Object.assign(config, {
    smtp_host: 'smtp.resend.com',
    smtp_port: '465',
    smtp_user: 'resend',
    smtp_pass: smtpKey,
    smtp_admin_email: process.env.SMTP_SENDER || 'noreply@mahidolstartup.site',
    smtp_sender_name: 'Mahidol Startup Club',
    smtp_max_frequency: 30,
  })
} else console.warn('! No RESEND key — SMTP not changed (built-in Supabase email allows only a few emails per hour).')

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  Object.assign(config, {
    external_google_enabled: true,
    external_google_client_id: process.env.GOOGLE_CLIENT_ID,
    external_google_secret: process.env.GOOGLE_CLIENT_SECRET,
  })
} else console.warn('! GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set — Google provider not changed.')

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(config),
})
const body = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error('Failed:', res.status, JSON.stringify(body).slice(0, 500))
  process.exit(1)
}
console.log('✓ Auth configured for', ref)
for (const k of ['site_url', 'security_sb_forwarded_for_enabled', 'rate_limit_email_sent', 'rate_limit_otp', 'smtp_host', 'smtp_admin_email', 'external_google_enabled'])
  console.log(`  ${k}: ${body[k]}`)
