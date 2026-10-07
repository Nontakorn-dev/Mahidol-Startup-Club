import type { NextConfig } from 'next'

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : 'hxbpcnlxyigjfqmkgcku.supabase.co'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'profile.line-scdn.net' },
      { protocol: 'https', hostname: 'obs.line-scdn.net' },
    ],
  },
}

export default nextConfig
