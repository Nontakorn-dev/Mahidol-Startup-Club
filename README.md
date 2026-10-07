# Mahidol Startup Club

เว็บช่วยนักศึกษาหางานแข่ง ทุน ทีม และ co-founder — พิมพ์ความต้องการเป็นประโยค แล้ว DeepSeek (ผ่าน OpenRouter) แปลงเป็นตัวกรองและพาไปหน้าที่ใช่ เชื่อม LINE OA สำหรับแจ้งเตือน และใช้อีเมลสำรองสำหรับคนที่ไม่ได้ผูก LINE

- Production: https://mahidol-startup-club.vercel.app
- Stack: Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage, Realtime) · Vercel · OpenRouter `deepseek/deepseek-v4.1-flash` · LINE Login + Messaging API · Resend
- ดีไซน์ต้นฉบับ: `MahidolStartupClub-design/` (ไม่ถูก deploy)

## ฟีเจอร์

| ส่วน | หน้า |
| --- | --- |
| หน้าแรก, ค้นหาด้วย AI | `/`, `/search?q=` (ชิปตัวกรองแก้ได้โดยไม่เรียก AI ซ้ำ, แท็บ งาน/ทีม/คน/Co-founder, “แนะนำเพราะ”, ปุ่มพาไปหน้าที่ตรงที่สุด) |
| งานแข่ง & ทุน | `/opportunities`, `/opportunities/[slug]` (สมัคร, บันทึก + เตือนก่อนปิด 3 วัน, แชร์, ทีมที่กำลังหาคน) |
| เพื่อนร่วมทีม | `/teams` (คนหาทีม / ทีมหาคน), `/teams/new`, `/teams/looking/new` |
| Co-founder | `/cofounder`, `/cofounder/new` |
| ข้อความ | `/inbox` — ส่งข้อความ, ขอทำความรู้จักแบบไม่ระบุชื่อ (เปิดเผยชื่อเมื่อตอบรับ), ชวนเข้าทีม/ขอเข้าทีม, ไฟล์แนบ, realtime |
| บัญชี | `/login` (LINE / ลิงก์อีเมล / รหัสผ่าน), `/onboarding`, `/me`, `/u/[id]`, `/settings/notifications` (เชื่อม/ยกเลิก LINE, หัวข้อแจ้งเตือน, ความถี่, เพิ่มอีเมลให้บัญชีที่สมัครผ่าน LINE) |
| แอดมิน | `/admin` ภาพรวม · `/admin/events` เพิ่ม/แก้งาน + พรีวิว + ดาวหน้าแรก · `/admin/community` ตรวจ/ลบโพสต์ · `/admin/users` ตั้งแอดมิน/ระงับ · `/admin/broadcasts` ส่งประกาศ LINE + อีเมล |
| LINE OA | webhook: follow/unfollow, ปุ่ม “ยอมรับ/ปฏิเสธ” ในแชต, พิมพ์ประโยคในแชตแล้ว AI ตอบเป็นการ์ดงาน, rich menu |

ช่องทางแจ้งเตือน: ผูก LINE + เป็นเพื่อน OA → ส่ง LINE · ไม่เช่นนั้น → อีเมล (ถ้าเปิดรับ) · เลือก “สรุปวันละครั้ง” ได้ (cron ทุกวัน 08:00 น.)

แอดมิน: อีเมลใน `ADMIN_EMAILS` ได้สิทธิ์แอดมินอัตโนมัติเมื่อล็อกอิน หรือตั้งจาก `/admin/users`

## ⚠️ สิ่งที่ต้องตั้งค่าเพิ่ม

### 1. Supabase Auth URL (จำเป็นสำหรับลิงก์อีเมล)
Dashboard → Authentication → URL Configuration
- **Site URL**: `https://mahidol-startup-club.vercel.app`
- **Redirect URLs**: `https://mahidol-startup-club.vercel.app/**` และ `http://localhost:3000/**`

แนะนำ (ให้ลิงก์อีเมลเปิดข้ามเบราว์เซอร์ได้ เช่น เปิดในแอปเมล): Authentication → Email Templates → Magic Link เปลี่ยนลิงก์เป็น
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/`

อีเมลระบบของ Supabase ส่งได้ไม่กี่ฉบับต่อชั่วโมง — ใช้งานจริงให้ตั้ง Custom SMTP (Authentication → SMTP Settings) ด้วย Resend: host `smtp.resend.com`, port `465`, user `resend`, password = Resend API key

### 2. LINE (Login + Official Account)
ทั้งสอง channel ต้องอยู่ใต้ **Provider เดียวกัน** ไม่เช่นนั้น LINE User ID จะไม่ตรงกัน

1. **Messaging API channel** — เปิดจาก LINE Official Account Manager → Settings → Messaging API → เลือก Provider
   - Channel secret → `LINE_MESSAGING_CHANNEL_SECRET`
   - Messaging API → Channel access token (long-lived) → `LINE_MESSAGING_ACCESS_TOKEN`
   - Webhook URL: `https://mahidol-startup-club.vercel.app/api/line/webhook` → เปิด **Use webhook**
   - ปิด Auto-reply messages และ Greeting messages (ระบบตอบเอง)
   - Basic ID ของ OA (เช่น `@mahidolstartup`) → `NEXT_PUBLIC_LINE_OA_ID`
2. **LINE Login channel** (Provider เดียวกัน)
   - Channel ID / Channel secret → `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`
   - Callback URL: `https://mahidol-startup-club.vercel.app/api/auth/line/callback` (เพิ่ม `http://localhost:3000/api/auth/line/callback` สำหรับ dev)
   - Basic settings → **Linked LINE Official Account** = OA ข้างบน (ทำให้มีปุ่มเพิ่มเพื่อนตอนล็อกอิน)
   - (ไม่บังคับ) OpenID Connect → ขอสิทธิ์ Email address เพื่อผูกกับบัญชีอีเมลเดิมอัตโนมัติ
   - เปลี่ยนสถานะ channel เป็น **Published**
3. ใส่ค่าทั้งหมดใน Vercel แล้ว deploy ใหม่:
   ```bash
   npx vercel env add LINE_LOGIN_CHANNEL_ID production   # ทำซ้ำทุกตัว
   npx vercel deploy --prod
   ```
4. สร้าง rich menu (งานแข่ง · เพื่อนร่วมทีม · ตั้งค่าแจ้งเตือน): ใส่ค่า LINE ใน `.env.local` และตั้ง `NEXT_PUBLIC_SITE_URL` เป็น URL production แล้วรัน `npm run line:richmenu`

### 3. อีเมลแจ้งเตือน (Resend)
Resend → Domains (verify โดเมนของชมรม) → API Keys แล้วตั้ง `RESEND_API_KEY` และ `EMAIL_FROM` (เช่น `Mahidol Startup Club <noreply@your-domain>`) ใน Vercel

### 4. ข้อมูลงานตั้งต้น
งาน 4 งานจากดีไซน์ถูก seed ไว้แล้ว แต่ลิงก์สมัครในดีไซน์เป็นตัวอย่าง (`forms.gle/xxxxxxxx`) จึงยังว่าง — เข้า `/admin/events` แล้วใส่ลิงก์สมัครจริง

## พัฒนาบนเครื่อง

```bash
npm install
cp .env.example .env.local   # ใส่ค่า (ดูคำอธิบายใน .env.local)
npm run dev                   # http://localhost:3000
npm run typecheck && npm run build
```

Environment variables: ดู `.env.example` — `SUPABASE_SECRET_KEY` (Dashboard → Project Settings → API Keys) ห้าม commit และห้ามใช้ฝั่ง client

## โครงสร้าง

```
src/app/(site)/        หน้าเว็บผู้ใช้ (header/footer)
src/app/admin/         หน้าแอดมิน
src/app/actions/       Server Actions (ตรวจสิทธิ์ทุกครั้ง)
src/app/api/           LINE login/webhook, cron, tracking, verify email
src/lib/ai/intent.ts   DeepSeek intent parser (JSON จำกัดค่า + cache + fallback)
src/lib/search.ts      query builder + จัดอันดับ + เหตุผล
src/lib/notify.ts      dispatcher LINE → อีเมล → digest
src/lib/line/          LINE Login (OIDC) และ Messaging API + Flex builders
src/lib/data/          อ่านข้อมูล + ซ่อนตัวตนโพสต์ไม่ระบุชื่อ
supabase/migrations/   schema, RLS, storage buckets, seed
scripts/               สคริปต์สร้าง LINE rich menu
```

ความปลอดภัย: ทุกตารางเปิด RLS ฝั่ง client อ่านได้เฉพาะงานที่เผยแพร่ โปรไฟล์ตัวเอง และบทสนทนาที่ตัวเองอยู่ (สำหรับ realtime) การเขียนทั้งหมดผ่าน server ด้วย service role หลังตรวจสิทธิ์ โพสต์ไม่ระบุชื่อจะไม่ส่ง id เจ้าของไปที่ browser (แม้แต่แอดมินก็ไม่เห็นชื่อ)
