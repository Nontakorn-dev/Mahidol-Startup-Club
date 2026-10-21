import type { NextConfig } from 'next'

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : 'hxbpcnlxyigjfqmkgcku.supabase.co'

const isDev = process.env.NODE_ENV !== 'production'

// Content-Security-Policy without nonces (see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
// "Without Nonces"): nonces would force every page to render dynamically. No third-party scripts are
// allowed at all, the browser may only talk to us and our Supabase project, and no one may frame the site.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}${isDev ? ' ws:' : ''}`,
  "media-src 'self'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  // Server-action forms post to us; the LINE account-link confirm form may redirect to LINE.
  "form-action 'self' https://access.line.me",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  // Settings moved to /me (LINE linking there; every notification is on). Old links keep working.
  async redirects() {
    return [
      { source: '/settings/notifications', destination: '/me#line', permanent: true },
      { source: '/settings/password', destination: '/me', permanent: true },
      // Co-founder posts now live on /teams with the other posts (query string carries over).
      { source: '/cofounder', destination: '/teams?tab=cofounder', permanent: true },
    ]
  },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
    // Keep visited pages in the browser for 30 s: back/forward and re-opening a tab are instant.
    // Server actions (save, post, approve…) still refresh what they change.
    staleTimes: { dynamic: 30, static: 180 },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' },
      // Posters of imported opportunities (Hackza stores them on its own Supabase project)
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      // Posters of imported events whose image was too large to copy into our bucket
      { protocol: 'https', hostname: 's3.siwatsystem.com' }, // Contester.Life
      { protocol: 'https', hostname: 'www.camphub.in.th', pathname: '/wp-content/**' },
      { protocol: 'https', hostname: 'api.dekport.com', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'd112y698adiu2z.cloudfront.net' }, // Devpost
      { protocol: 'https', hostname: 'profile.line-scdn.net' },
      { protocol: 'https', hostname: 'obs.line-scdn.net' },
    ],
  },
}

export default nextConfig
