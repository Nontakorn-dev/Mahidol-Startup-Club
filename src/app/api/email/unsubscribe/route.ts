import { NextResponse, type NextRequest } from 'next/server'
import { unsubscribeEmail, unsubscribeUserId } from '@/lib/unsubscribe'

// RFC 8058 one-click unsubscribe: mail clients POST here from the List-Unsubscribe header.
export async function POST(request: NextRequest) {
  const uid = unsubscribeUserId(request.nextUrl.searchParams.get('t'))
  if (!uid) return NextResponse.json({ ok: false }, { status: 400 })
  await unsubscribeEmail(uid)
  return NextResponse.json({ ok: true })
}

// A plain GET (e.g. link scanners) must not unsubscribe — send people to the confirm page.
export async function GET(request: NextRequest) {
  const url = new URL('/unsubscribe', request.url)
  url.searchParams.set('t', request.nextUrl.searchParams.get('t') || '')
  return NextResponse.redirect(url)
}
