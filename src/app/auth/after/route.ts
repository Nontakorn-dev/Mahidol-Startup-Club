import { NextResponse, type NextRequest } from 'next/server'
import { getViewer } from '@/lib/auth'

// Single post-login hop: new users go through onboarding first.
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('next') || '/'
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  const viewer = await getViewer()
  if (!viewer) return NextResponse.redirect(new URL('/login', request.url))
  if (!viewer.profile.onboarded) return NextResponse.redirect(new URL(`/onboarding?next=${encodeURIComponent(next)}`, request.url))
  return NextResponse.redirect(new URL(next, request.url))
}
