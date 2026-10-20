import { NextResponse } from 'next/server'
import { serverEnv } from '@/lib/env'
import { safeEqual } from '@/lib/crypto'
import { BatchSchema, ingestBatch } from '@/lib/importers/ingest'

export const maxDuration = 60

const MAX_BODY_BYTES = 1_000_000

// Daily opportunity feed (ChatGPT): listings land in /admin/imports for an admin to review —
// never published automatically. Request/response shape: GET /api/imports/openapi.json.
export async function POST(request: Request) {
  const { importApiKey } = serverEnv()
  const auth = request.headers.get('authorization') || ''
  if (!importApiKey || !safeEqual(auth, `Bearer ${importApiKey}`)) {
    return NextResponse.json({ ok: false, error: 'unauthorized — ส่ง Authorization: Bearer <IMPORT_API_KEY>' }, { status: 401 })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: `body ใหญ่เกิน ${MAX_BODY_BYTES / 1_000_000} MB — แบ่งส่งหลายครั้ง` }, { status: 413 })
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: false, error: 'body ต้องเป็น JSON' }, { status: 400 })
  }
  const batch = BatchSchema.safeParse(json)
  if (!batch.success) {
    return NextResponse.json({ ok: false, error: batch.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') }, { status: 400 })
  }

  try {
    const { results, summary } = await ingestBatch(batch.data.items, batch.data.run_id ?? null)
    return NextResponse.json({ ok: true, run_id: batch.data.run_id ?? null, received: batch.data.items.length, summary, results })
  } catch (err) {
    console.error('POST /api/imports', err)
    return NextResponse.json({ ok: false, error: 'บันทึกไม่สำเร็จ ลองส่งใหม่อีกครั้ง (ส่งชุดเดิมซ้ำได้ ระบบจะอัปเดตแทนการสร้างซ้ำ)' }, { status: 500 })
  }
}
