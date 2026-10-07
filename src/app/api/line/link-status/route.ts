import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth'

// Polled by the "เชื่อมต่อ LINE" card while the user sends their code in the OA chat.
export async function GET() {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ linked: false }, { status: 401 })
  return NextResponse.json({ linked: Boolean(viewer.profile.line_user_id), friend: viewer.profile.line_is_friend })
}
