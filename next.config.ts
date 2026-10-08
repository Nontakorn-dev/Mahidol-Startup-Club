import type { NextConfig } from 'next'

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : 'hxbpcnlxyigjfqmkgcku.supabase.co'

const nextConfig: NextConfig = {
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
