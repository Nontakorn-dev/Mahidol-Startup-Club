import { NextResponse, type NextRequest } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

const TTL_MS = 15 * 60_000

// One-time "continue" link from /line/linked: signs the person in on this browser (usually
// LINE's in-app browser) right after they linked LINE, then opens the interests page.
// The token was minted by our callback after LINE verified the account; it works once, for 15 min.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t') || ''
  const fail = () => NextResponse.redirect(new URL('/login?next=%2Fsettings%2Finterests', request.url))
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return fail()
  const db = adminClient()
  const { data: row } = await db
    .from('line_login_states')
    .update({ continue_used_at: new Date().toISOString() })
    .eq('continue_token', token)
    .is('continue_used_at', null)
    .gte('created_at', new Date(Date.now() - TTL_MS).toISOString())
    .select('user_id, next')
    .maybeSingle()
  if (!row) return fail()
  const { data: user } = await db.auth.admin.getUserById(row.user_id)
  const email = user?.user?.email
  if (!email) return fail()
  // A magic-link token generated server-side (no email is sent); /login completes the session.
  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) return fail()
  const next = `/settings/interests?linked=1&next=${encodeURIComponent(row.next || '/opportunities')}`
  return NextResponse.redirect(new URL(`/login?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`, request.url))
}
