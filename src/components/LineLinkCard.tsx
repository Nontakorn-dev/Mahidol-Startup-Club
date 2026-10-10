import QRCode from 'qrcode'
import { IconLine, IconQr } from './icons'
import { UnlinkLineButton } from './NotificationSettings'
import LinkStatusPoller from './LinkStatusPoller'
import { getOrCreateLinkCode, LINK_CODE_TTL_MIN, oaMessageUrl } from '@/lib/line/link'
import { lineAddFriendUrl, lineLoginEnabled } from '@/lib/env'
import { isOaFriend } from '@/lib/line/messaging'
import { adminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/lib/types'

/**
 * "🔗 เชื่อมต่อ LINE" — links the signed-in email account to a LINE User ID.
 *  • Button: LINE Login consent (when the LINE Login channel is configured)
 *  • QR / mobile button: opens the OA chat with a one-time code; the webhook links it and this card auto-refreshes
 */
export default async function LineLinkCard({ p, next = '/me', compact }: { p: Profile; next?: string; compact?: boolean }) {
  const addFriend = lineAddFriendUrl()
  if (p.line_user_id && !p.line_is_friend && (await isOaFriend(p.line_user_id))) {
    // Added the OA some other way (QR, search, before linking) — remember it.
    await adminClient().from('profiles').update({ line_is_friend: true }).eq('id', p.id)
    p = { ...p, line_is_friend: true }
  }
  if (p.line_user_id) {
    const qr = !p.line_is_friend && addFriend ? await QRCode.toString(addFriend, { type: 'svg', margin: 1, color: { dark: '#10233F', light: '#FFFFFF' } }) : null
    return (
      <div className="stack" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <span style={{ flex: 'none', width: 44, height: 44, borderRadius: 14, background: '#E7F8EE', color: '#06C755', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconLine size={24} />
          </span>
          <span className="stack" style={{ flex: 1, lineHeight: 1.4 }}>
            <b style={{ fontSize: 16 }}>เชื่อม LINE แล้ว ✓</b>
            <span className="muted" style={{ fontSize: 13 }}>
              {p.line_display_name ? `บัญชี LINE: ${p.line_display_name}` : 'บันทึก LINE User ID กับบัญชีอีเมลของคุณแล้ว'}
            </span>
          </span>
        </div>
        {p.line_is_friend ? (
          <div className="alert alert-ok">รับข่าวสารผ่าน LINE OA ได้แล้ว</div>
        ) : (
          <div className="stack" style={{ gap: 12, padding: 16, borderRadius: 16, background: 'var(--yellow-soft)', border: '1px solid #F6D77A' }}>
            <LinkStatusPoller until="friend" />
            <span className="stack" style={{ gap: 4, color: '#4A3600' }}>
              <b style={{ fontSize: 16 }}>อีกขั้นเดียว: เพิ่มเพื่อน Mahidol Startup Club</b>
              <span style={{ fontSize: 14 }}>เพิ่มเพื่อนแล้ว คำชวนเข้าทีม งานที่ตรงกับคุณ และการเตือนก่อนปิดรับจะส่งมาทาง LINE (ระหว่างนี้ส่งทางอีเมลแทน) — หน้านี้จะอัปเดตเองเมื่อเพิ่มแล้ว</span>
            </span>
            <span className="row wrap" style={{ gap: 14, alignItems: 'center' }}>
              {addFriend && (
                <a href={addFriend} target="_blank" rel="noopener" className="btn btn-line" style={{ minHeight: 50, padding: '0 24px', borderRadius: 14, fontSize: 16 }}>
                  <IconLine size={22} /> เพิ่มเพื่อนใน LINE
                </a>
              )}
              {qr && (
                <span className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <span className="qr-box" style={{ borderStyle: 'solid', width: 88, height: 88 }} dangerouslySetInnerHTML={{ __html: qr }} />
                  <span className="muted" style={{ fontSize: 12, maxWidth: 120 }}>อยู่บนคอม? สแกนด้วยมือถือ</span>
                </span>
              )}
            </span>
          </div>
        )}
        {!compact && (
          <span className="row" style={{ gap: 8 }}>
            <UnlinkLineButton />
          </span>
        )}
      </div>
    )
  }

  const code = await getOrCreateLinkCode(p.id)
  const message = `เชื่อมบัญชี ${code}`
  const chatUrl = oaMessageUrl(message)
  const qr = chatUrl ? await QRCode.toString(chatUrl, { type: 'svg', margin: 1, color: { dark: '#10233F', light: '#FFFFFF' } }) : null
  // LINE Login first everywhere (links + adds the OA in one step); the chat-code button stays as a fallback.
  const loginReady = lineLoginEnabled()
  return (
    <div className="stack" style={{ gap: 18 }}>
      <LinkStatusPoller />
      <ol className="step-list">
        <li>
          <span>1</span>กดปุ่ม “เชื่อมต่อ LINE” (บนคอมสแกน QR ได้)
        </li>
        <li>
          <span>2</span>ยืนยันใน LINE และเพิ่มเพื่อน Mahidol Startup Club
        </li>
        <li>
          <span>3</span>กลับมาที่หน้านี้ ระบบจะเชื่อมให้อัตโนมัติ
        </li>
      </ol>
      {/* Phones: just the buttons (scanning a QR on the same phone makes no sense). */}
      <div className="line-connect">
        <div className="qr-box line-connect-qr">
          {qr ? (
            <span dangerouslySetInnerHTML={{ __html: qr }} style={{ width: '100%', height: '100%', display: 'block' }} />
          ) : (
            <>
              <IconQr size={28} />
              QR LINE OA
            </>
          )}
        </div>
        <div className="line-connect-body">
          <span className="stack line-connect-scan" style={{ lineHeight: 1.45 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>สแกนด้วยกล้องมือถือ</span>
            <span className="muted" style={{ fontSize: 13 }}>
              แชต LINE จะเปิดพร้อมข้อความ <b style={{ color: 'var(--navy)' }}>“{message}”</b> กดส่งแล้วเสร็จ (รหัสใช้ได้ {LINK_CODE_TTL_MIN} นาที)
            </span>
          </span>
          <span className="line-connect-actions">
            {loginReady ? (
              <a href={`/api/auth/line/start?next=${encodeURIComponent(next)}`} className="btn btn-line line-connect-main">
                <IconLine size={22} />
                เชื่อมต่อ LINE
              </a>
            ) : (
              chatUrl && (
                <a href={chatUrl} className="btn btn-line line-connect-main">
                  <IconLine size={22} />
                  เชื่อมต่อ LINE
                </a>
              )
            )}
            {loginReady && chatUrl && (
              <a href={chatUrl} className="btn btn-outline line-connect-alt">
                เปิดแชตพร้อมรหัส
              </a>
            )}
          </span>
          {!loginReady && !chatUrl && <span className="muted" style={{ fontSize: 13 }}>ผู้ดูแลยังไม่ได้ตั้งค่า LINE OA</span>}
          {loginReady && chatUrl && (
            <span className="muted" style={{ fontSize: 13 }}>
              ถ้า LINE แจ้งข้อผิดพลาด ให้กด “เปิดแชตพร้อมรหัส” แล้วกดส่งข้อความในแชต — ระบบจะเชื่อมให้ทันที
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
