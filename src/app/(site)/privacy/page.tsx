import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'นโยบายความเป็นส่วนตัว' }

const UPDATED = '8 ตุลาคม 2569'

export default function PrivacyPage() {
  return (
    <div className="bg-soft">
      <article className="panel" style={{ maxWidth: 760, margin: '40px auto 96px', lineHeight: 1.85 }}>
        <h1 style={{ margin: 0, fontWeight: 600, fontSize: 32 }}>นโยบายความเป็นส่วนตัว (PDPA)</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          Mahidol Startup Club (https://mahidolstartup.site) · ปรับปรุงล่าสุด {UPDATED}
        </p>

        <h2>ข้อมูลที่เราเก็บ</h2>
        <ul>
          <li>อีเมลที่ใช้สมัคร</li>
          <li>
            เมื่อคุณเลือก <b>เข้าสู่ระบบด้วย Google</b>: เราได้รับเฉพาะ ชื่อ อีเมล และรูปโปรไฟล์จากบัญชี Google ของคุณ (สิทธิ์พื้นฐาน openid, email, profile) — ไม่ได้เข้าถึง Gmail, Drive, รายชื่อติดต่อ หรือข้อมูลอื่นใดใน Google
          </li>
          <li>เมื่อคุณเชื่อม LINE: LINE User ID ชื่อที่แสดง และรูปโปรไฟล์ LINE (ใช้ส่งข่าวสารผ่าน LINE OA เท่านั้น)</li>
          <li>ข้อมูลโปรไฟล์ที่คุณกรอกเอง เช่น คณะ ชั้นปี ทักษะ ผลงาน และประกาศที่คุณโพสต์</li>
          <li>ข้อความในกล่องข้อความระหว่างสมาชิก และไฟล์แนบ (เก็บแบบส่วนตัว เปิดได้เฉพาะคู่สนทนา)</li>
          <li>คำที่พิมพ์ในช่องค้นหา และสถิติการเข้าชมหน้างานและการกดสมัคร เพื่อปรับปรุงบริการ</li>
        </ul>

        <h2>การใช้ข้อมูล</h2>
        <ul>
          <li>สร้างและยืนยันบัญชีของคุณ (ข้อมูลจาก Google ใช้เพื่อการนี้และแสดงชื่อ/รูปบนโปรไฟล์ของคุณเท่านั้น)</li>
          <li>แนะนำงานแข่ง ทีม และคนที่ตรงกับคุณ</li>
          <li>ส่งแจ้งเตือนผ่าน LINE OA (เมื่อคุณเชื่อม LINE) หรืออีเมล ตามหัวข้อที่คุณเลือกในหน้าตั้งค่า — ยกเลิกได้ทุกเมื่อ</li>
          <li>เราไม่ขายหรือให้เช่าข้อมูล ไม่ใช้ข้อมูลจาก Google เพื่อโฆษณา และไม่อ่านแชต LINE ส่วนตัวของคุณ</li>
        </ul>

        <h2>การจัดเก็บและผู้ให้บริการที่เกี่ยวข้อง</h2>
        <p>
          ข้อมูลเก็บในฐานข้อมูล Supabase (ภูมิภาคสิงคโปร์) และเว็บให้บริการผ่าน Vercel ส่งอีเมลผ่าน Resend และข้อความ LINE ผ่าน LINE Messaging API ผู้ให้บริการเหล่านี้ประมวลผลข้อมูลแทนเราเพื่อให้บริการเท่านั้น
          คำค้นหาอาจถูกส่งให้ผู้ให้บริการ AI เพื่อแปลงเป็นตัวกรอง โดยลบอีเมล เบอร์โทร เลขบัตรประชาชน และลิงก์ออกก่อนส่ง การเชื่อมต่อทั้งหมดเข้ารหัส (HTTPS)
        </p>

        <h2>สิทธิ์ของคุณ</h2>
        <p>
          คุณแก้ไขโปรไฟล์ ปิดการแจ้งเตือน ยกเลิกการเชื่อม LINE และลบประกาศได้ด้วยตัวเอง หากต้องการขอสำเนาข้อมูลหรือลบบัญชีทั้งหมด (รวมข้อมูลที่ได้จาก Google) ติดต่อชมรมผ่าน LINE OpenChat หรือ Instagram
          @mahidolstartup_official เราจะดำเนินการภายใน 30 วัน คุณยังเพิกถอนสิทธิ์ของเว็บนี้ในบัญชี Google ได้ที่ myaccount.google.com/permissions
        </p>

        <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid var(--line)' }} />
        <section lang="en">
          <h2>Privacy policy (English summary)</h2>
          <p>
            Mahidol Startup Club (mahidolstartup.site) is a student club website that helps university students find competitions, grants, teammates and co-founders.
          </p>
          <ul>
            <li>
              <b>Google user data:</b> when you choose “Continue with Google” we receive only your name, email address and profile picture (scopes: openid, email, profile). We use them solely to create and sign in to your account and to show your name and photo on your profile. We do not access any other Google data.
            </li>
            <li>
              We do not sell, rent or share Google user data with third parties, and we do not use it for advertising. It is stored in our database hosted by Supabase and processed only by service providers that run this site (Vercel hosting, Resend email, LINE Messaging API for users who link LINE).
            </li>
            <li>Other data: profile details you enter, posts and messages you send on the site, and basic usage statistics used to improve the service.</li>
            <li>
              You can edit your profile, turn off notifications and unlink LINE yourself. To export or delete your account and all associated data (including data received from Google), contact the club via LINE OpenChat or Instagram @mahidolstartup_official; requests are completed within 30 days. You can also revoke access at myaccount.google.com/permissions.
            </li>
          </ul>
          <p className="muted">Last updated: October 8, 2026.</p>
        </section>
      </article>
    </div>
  )
}
