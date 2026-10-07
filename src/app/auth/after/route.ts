import { NextResponse, type NextRequest } from 'next/server'
import { getViewer } from '@/lib/auth'
import { resolvePostLogin } from '@/lib/post-login'

// Post-login hop for email links: OA account link first, then onboarding, then `next`.
export async function GET(request: NextRequest) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.redirect(new URL('/login', request.url))
  const dest = await resolvePostLogin(viewer.userId, request.nextUrl.searchParams.get('next'))
  return NextResponse.redirect(dest.startsWith('http') ? dest : new URL(dest, request.url))
}
