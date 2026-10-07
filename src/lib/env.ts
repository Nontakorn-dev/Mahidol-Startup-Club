// Central access to environment variables, with helpers that report which
// integrations are configured so the UI can degrade gracefully.

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  lineOaId: process.env.NEXT_PUBLIC_LINE_OA_ID || '',
}

export function serverEnv() {
  return {
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    adminEmails: (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    cronSecret: process.env.CRON_SECRET || '',
    appSecret: process.env.APP_SECRET || process.env.CRON_SECRET || 'dev-secret',
    openrouterKey: process.env.OPENROUTER_API_KEY || '',
    openrouterModel: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4.1-flash',
    lineLoginChannelId: process.env.LINE_LOGIN_CHANNEL_ID || '',
    lineLoginChannelSecret: process.env.LINE_LOGIN_CHANNEL_SECRET || '',
    lineMessagingSecret: process.env.LINE_MESSAGING_CHANNEL_SECRET || '',
    lineMessagingToken: process.env.LINE_MESSAGING_ACCESS_TOKEN || '',
    resendKey: process.env.RESEND_API_KEY || '',
    emailFrom: process.env.EMAIL_FROM || 'Mahidol Startup Club <onboarding@resend.dev>',
  }
}

export const lineLoginEnabled = () =>
  Boolean(process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET)
export const lineMessagingEnabled = () => Boolean(process.env.LINE_MESSAGING_ACCESS_TOKEN)
export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY)

/** "Add friend" URL for the Official Account, or null when not configured. */
export function lineAddFriendUrl() {
  const id = env.lineOaId.trim()
  if (!id) return null
  return `https://line.me/R/ti/p/${encodeURIComponent(id.startsWith('@') ? id : `@${id}`)}`
}
