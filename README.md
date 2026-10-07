# Mahidol Startup Club

เว็บช่วยนักศึกษาหางานแข่ง ทุน ทีม และ co-founder — พิมพ์ความต้องการเป็นประโยค แล้ว DeepSeek (ผ่าน OpenRouter) แปลงเป็นตัวกรองและพาไปหน้าที่ใช่ บัญชีผู้ใช้เป็น **อีเมล** เสมอ แล้ว **เชื่อม LINE** ภายหลังเพื่อรับข่าวสารผ่าน LINE OA (คนที่ไม่เชื่อมได้รับทางอีเมล)

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
| บัญชี | `/login` (อีเมล: รหัส 6 หลัก/ลิงก์ หรือรหัสผ่าน), `/onboarding`, `/me` (🔗 เชื่อมต่อ LINE), `/u/[id]`, `/settings/notifications` (เชื่อม/ยกเลิก LINE, หัวข้อแจ้งเตือน, ความถี่) |
| แอดมิน | `/admin` ภาพรวม · `/admin/imports` ตรวจงานที่ดึงจาก Hackza · `/admin/events` เพิ่ม/แก้งาน + พรีวิว + ดาวหน้าแรก · `/admin/community` ตรวจ/ลบโพสต์ · `/admin/users` ตั้งแอดมิน/ระงับ · `/admin/broadcasts` ส่งประกาศ LINE + อีเมล |
| LINE OA | webhook: follow/unfollow, account link, ปุ่ม “ยอมรับ/ปฏิเสธ” ในแชต, พิมพ์ประโยคในแชตแล้ว AI ตอบเป็นการ์ดงาน, rich menu |

### การเชื่อม LINE (Email User ID ↔ LINE User ID)

LINE ไม่ใช่ช่องทางล็อกอิน — ใช้เพื่อผูกกับบัญชีอีเมลและรับข่าวสารเท่านั้น

1. **เริ่มจากเว็บ**: สมัคร/ล็อกอินด้วยอีเมล → `/me` → 🔗 เชื่อมต่อ LINE
   - ถ้ามี LINE Login channel: ปุ่มพาไปหน้ายืนยันของ LINE (พร้อมเพิ่มเพื่อน OA) → กลับมาที่เว็บ เชื่อมแล้ว
   - หรือสแกน QR / กดเปิดแชต: LINE เปิดแชต OA พร้อมข้อความ `เชื่อมบัญชี ABC123` (รหัสใช้ครั้งเดียว 15 นาที) → กดส่ง → webhook ผูกบัญชี → หน้าเว็บรีเฟรชเอง
2. **เริ่มจาก LINE OA** (LINE Account Link): เพิ่มเพื่อน / กดเมนู “ตั้งค่าแจ้งเตือน” / พิมพ์ “เชื่อมบัญชี” → บอทส่งลิงก์เฉพาะ (`/line/link?linkToken=…`, 10 นาที) → เว็บ → สมัคร/ล็อกอินด้วยอีเมล (กรอกรหัส 6 หลักได้ในเบราว์เซอร์ของ LINE เลย) → ระบบพาไปหน้ายืนยันของ LINE ทันที → webhook `accountLink` ผูกบัญชี → บอทแจ้งว่าเชื่อมสำเร็จ และชวนกรอกโปรไฟล์ต่อ

ช่องทางแจ้งเตือน: ผูก LINE + เป็นเพื่อน OA → ส่ง LINE · ไม่เช่นนั้น → อีเมล (ถ้าเปิดรับ) · เลือก “สรุปวันละครั้ง” ได้ (cron ทุกวัน 08:00 น.)

แอดมิน: อีเมลใน `ADMIN_EMAILS` ได้สิทธิ์แอดมินอัตโนมัติเมื่อล็อกอิน หรือตั้งจาก `/admin/users`

## ดึงงานจาก Hackza (อัตโนมัติ + แอดมินตรวจ)

```
ทุก 6 ชั่วโมง → /api/cron/hackza → ดึง hackza.org/hackathons → คัดเฉพาะสาย startup · นวัตกรรม · workshop · ธุรกิจ
→ event_imports (pending) → /admin/imports → อนุมัติ & เผยแพร่ / แก้ไขก่อนเผยแพร่ / ไม่เอา → นักศึกษาเห็น (+ แจ้งเตือนคนที่สนใจ)
```

- ตรวจสอบแล้ว: Hackza **ไม่มี Public API** และ robots.txt `Disallow: /api/` จึงไม่เรียก API ภายในของเขา ใช้เฉพาะหน้า `/hackathons` (อนุญาต) ซึ่งฝังข้อมูลทุกรายการไว้ในหน้าเดียว
- ไม่มี Cloudflare/CAPTCHA และเราไม่ bypass ระบบป้องกันใดๆ · ตรวจ robots.txt ทุกครั้งก่อนดึง · 1 request ต่อรอบ · User-Agent ระบุตัวตน · ถ้าโดน 403/429 จะหยุดรอรอบถัดไป · ปุ่ม “ซิงก์ตอนนี้” กดได้ไม่เกิน 1 ครั้ง/10 นาที
- คะแนนความเกี่ยวข้อง (`src/lib/importers/hackza.ts`): คำสำคัญ startup/ผู้ประกอบการ/ธุรกิจ/นวัตกรรม/pitch/บ่มเพาะ (ชื่อหนัก × 2) + workshop/hackathon/AI/สุขภาพ/ความยั่งยืน + ประเภทงาน, ตัดงานที่ปิดรับแล้ว, งานเฉพาะ ม.ปลาย, ประกวดภาพยนตร์/ออกแบบ/exchange — ปรับ threshold ได้ที่ `RELEVANCE_THRESHOLD`
- งานที่อนุมัติแสดงเครดิต “ข้อมูลจาก Hackza” และใช้ลิงก์สมัครของผู้จัด · การตัดสินใจอนุมัติ/ไม่เอาจะไม่ถูกเขียนทับในรอบซิงก์ถัดไป

## ⚠️ สิ่งที่ต้องตั้งค่าเพิ่ม

### 1. Supabase Auth URL (จำเป็นสำหรับลิงก์อีเมล)
Dashboard → Authentication → URL Configuration
- **Site URL**: `https://mahidol-startup-club.vercel.app`
- **Redirect URLs**: `https://mahidol-startup-club.vercel.app/**` และ `http://localhost:3000/**`

**Email Templates** (Authentication → Email Templates) — ทั้ง “Magic Link” และ “Confirm signup” ให้ใส่
- รหัส 6 หลัก `{{ .Token }}` — ผู้ที่สมัครจากในแอป LINE กรอกรหัสได้โดยไม่ต้องสลับแอป
- ลิงก์ `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` — เปิดได้ทุกเบราว์เซอร์และพากลับไปทำต่อ (รวมถึงการเชื่อม LINE)

อีเมลระบบของ Supabase ส่งได้ไม่กี่ฉบับต่อชั่วโมง — ใช้งานจริงให้ตั้ง Custom SMTP (Authentication → SMTP Settings) ด้วย Resend: host `smtp.resend.com`, port `465`, user `resend`, password = Resend API key

### 2. LINE Official Account
1. **Messaging API channel (จำเป็น)** — LINE Official Account Manager → Settings → Messaging API → เลือก Provider
   - Channel secret → `LINE_MESSAGING_CHANNEL_SECRET`
   - Messaging API → Channel access token (long-lived) → `LINE_MESSAGING_ACCESS_TOKEN` (ใช้ทั้งส่งข้อความและออก linkToken สำหรับ account link)
   - Webhook URL: `https://mahidol-startup-club.vercel.app/api/line/webhook` → เปิด **Use webhook**
   - ปิด Auto-reply messages และ Greeting messages (บอทตอบเอง)
   - Basic ID ของ OA (เช่น `@mahidolstartup`) → `NEXT_PUBLIC_LINE_OA_ID` (ใช้สร้าง QR / ลิงก์เปิดแชตพร้อมรหัส)
2. **LINE Login channel (ไม่บังคับ)** — ทำให้ปุ่ม “เชื่อมต่อ LINE” บนเว็บไปหน้ายืนยันของ LINE โดยตรง (ไม่มีก็ใช้ QR/รหัสแทนได้)
   - ต้องอยู่ **Provider เดียวกับ OA** (LINE User ID จึงตรงกัน)
   - Channel ID / secret → `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`
   - Callback URL: `https://mahidol-startup-club.vercel.app/api/auth/line/callback`
   - Basic settings → **Linked LINE Official Account** = OA ข้างบน แล้วเปลี่ยนเป็น **Published**
3. ใส่ค่าใน Vercel แล้ว deploy ใหม่:
   ```bash
   npx vercel env add LINE_MESSAGING_ACCESS_TOKEN production   # ทำซ้ำทุกตัว
   npx vercel deploy --prod
   ```
4. สร้าง rich menu (งานแข่ง · เพื่อนร่วมทีม · ตั้งค่าแจ้งเตือน/เชื่อมบัญชี): ใส่ค่า LINE ใน `.env.local`, ตั้ง `NEXT_PUBLIC_SITE_URL` เป็น URL production แล้วรัน `npm run line:richmenu`

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
src/app/api/           LINE link (Login consent)/webhook, cron, tracking
src/app/line/link/     ลิงก์เฉพาะจาก OA (linkToken) → ล็อกอินอีเมล → LINE account link
src/lib/ai/intent.ts   DeepSeek intent parser (JSON จำกัดค่า + cache + fallback)
src/lib/search.ts      query builder + จัดอันดับ + เหตุผล
src/lib/notify.ts      dispatcher LINE → อีเมล → digest
src/lib/line/          การเชื่อมบัญชี (link.ts), LINE Login consent, Messaging API + Flex builders
src/lib/data/          อ่านข้อมูล + ซ่อนตัวตนโพสต์ไม่ระบุชื่อ
supabase/migrations/   schema, RLS, storage buckets, seed
scripts/               สคริปต์สร้าง LINE rich menu
```

ความปลอดภัย: ทุกตารางเปิด RLS ฝั่ง client อ่านได้เฉพาะงานที่เผยแพร่ โปรไฟล์ตัวเอง และบทสนทนาที่ตัวเองอยู่ (สำหรับ realtime) การเขียนทั้งหมดผ่าน server ด้วย service role หลังตรวจสิทธิ์ โพสต์ไม่ระบุชื่อจะไม่ส่ง id เจ้าของไปที่ browser (แม้แต่แอดมินก็ไม่เห็นชื่อ)
