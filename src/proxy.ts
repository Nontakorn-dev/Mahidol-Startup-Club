import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Refreshes the Supabase session cookie on every page request so Server
// Components always see a valid session. Authorisation happens in the pages.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|assets/|api/line/webhook|api/cron|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
