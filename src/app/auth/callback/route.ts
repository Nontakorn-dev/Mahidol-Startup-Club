import { NextResponse, type NextRequest } from 'next/server'

// Old email links pointed here. Sessions are now created in the browser on /login (the PKCE
// verifier is a browser cookie, and Auth rate limits apply to the visitor's own IP).
export async function GET(request: NextRequest) {
  const url = new URL('/login', request.url)
  request.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v))
  return NextResponse.redirect(url)
}
