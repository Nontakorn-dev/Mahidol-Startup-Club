# Mahidol Startup Club — เช็กลิสต์ตั้งค่าให้ระบบครบ

> อัปเดตล่าสุด: 8 ต.ค. 2569 · เว็บ: https://mahidol-startup-club.vercel.app · โค้ด: https://github.com/Nontakorn-dev/Mahidol-Startup-Club
>
> ทำตามลำดับจากบนลงล่าง ทุกขั้นมี ☐ ให้ติ๊ก
> - 👤 = **คุณต้องทำเอง** (ต้องล็อกอินบัญชีของคุณ หรือเกี่ยวกับรหัสลับ)
> - 🤖 = **ให้ Claude ทำต่อได้** — ทำส่วน 👤 ของขั้นนั้นเสร็จ แล้วบอกว่า “ทำขั้น X เสร็จแล้ว”
>
> 🔒 **กฎเรื่องรหัสลับ:** ห้ามวาง key/secret/token ในแชตหรือ commit ขึ้น Git — ใส่ในไฟล์ `.env.local` เท่านั้น (ไฟล์นี้ไม่ขึ้น Git อยู่แล้ว) บรรทัดว่างสำหรับทุกค่าเตรียมไว้ให้แล้ว

---

## 0. สถานะตอนนี้

| ส่วน | สถานะ | ขาดอะไร |
| --- | --- | --- |
| เว็บไซต์ + Vercel | ✅ ใช้งานได้ | — |
| ฐานข้อมูล Supabase | ✅ ใช้งานได้ | — |
| ค้นหาด้วย AI (DeepSeek ผ่าน OpenRouter) | ✅ ใช้งานได้ | ดูยอดเครดิต OpenRouter เป็นระยะ |
| ล็อกอินด้วยรหัสผ่าน | ✅ ใช้งานได้ | — |
| ล็อกอินด้วยรหัส 6 หลักทางอีเมล / สมัครสมาชิก | ⚠️ ใช้ได้น้อยมาก | Supabase ส่งอีเมลเองได้ไม่กี่ฉบับ/ชม. และลิงก์ในอีเมลยังพาไป `localhost` → **ขั้น 1–3** |
| Continue with Google | ❌ ปุ่มยังซ่อน | **ขั้น 4** |
| อีเมลแจ้งเตือน/ประกาศ | ❌ ยังไม่ส่ง | DNS + Resend key → **ขั้น 1–3** |
| LINE OA (เชื่อมบัญชี, แจ้งเตือน, แชตบอต AI, rich menu) | ❌ ยังไม่เปิด | **ขั้น 5–6** |
| ดึงงานจาก Hackza ทุก 6 ชม. | ✅ ทำงานอยู่ | อนุมัติงานที่ `/admin/imports` เป็นประจำ |
| งานตั้งต้น 4 งาน | ⚠️ ยังไม่มีลิงก์สมัคร | **ขั้น 7** |

---

## ขั้น 1 — ใส่ DNS อีเมลที่ Namecheap (👤 ~10 นาที แล้วรอ 5–30 นาที)

เพื่อให้ส่งอีเมลในนาม `noreply@mahidolstartup.site` ได้ และไม่ตกถังขยะ (เพิ่มโดเมนใน Resend ไว้ให้แล้ว)

1. ☐ เข้า https://ap.www.namecheap.com → **Domain List** → แถว `mahidolstartup.site` กด **Manage**
2. ☐ แท็บ **Advanced DNS** → ส่วน **Host Records** กด **Add New Record** เพิ่มทีละแถว:

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| TXT Record | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCbo8g9XVATN6gDgIe56xHg7NPMF5NEYeUtbYGK4iorbajcOsr8cMzHOdv23PiHdUbm/Rxacjk+el7lvVpF6+BiCBRAYKJ8297Bad5zJroCgbPnuV0nbFdUNQn1i6dl1IDgyKuUktyBnrb7ujTViJ969CLX7HJFbXc7R41WivdSkQIDAQAB` | Automatic |
| TXT Record | `send` | `v=spf1 include:amazonses.com ~all` | Automatic |
| CNAME Record | `rsend` | `send.forge.rmta.net` | Automatic |
| TXT Record | `_dmarc` | `v=DMARC1; p=none;` | Automatic |

3. ☐ ส่วน **Mail Settings** (ด้านล่างของหน้าเดียวกัน) — Namecheap ให้เพิ่ม MX ได้ที่ส่วนนี้เท่านั้น:
   - ตอนนี้โดเมนตั้งเป็น **Email Forwarding** (ค่าเริ่มต้นของ Namecheap)
   - ถ้า **ยังไม่ได้ตั้งกฎ forward อีเมลใดๆ** (โดเมนเพิ่งซื้อ น่าจะเป็นแบบนี้) → เปลี่ยน dropdown เป็น **Custom MX** แล้วเพิ่มแถวเดียว:
     - Host `send` → Value `feedback-smtp.ap-northeast-1.amazonses.com` → Priority **10**
   - ถ้า **ใช้ forward อีเมลอยู่** (เช่น `contact@mahidolstartup.site` → Gmail) **อย่าเพิ่งเปลี่ยน** เพราะการเปลี่ยนเป็น Custom MX จะหยุด forwarding — บอก Claude ก่อน จะหาวิธีที่ไม่กระทบให้
4. ☐ แถว TXT เดิมที่ Host `@` (`v=spf1 include:spf.efwd...`) เป็นของ email forwarding — ถ้าเปลี่ยนเป็น Custom MX แล้วจะลบหรือเก็บไว้ก็ได้ ไม่ชนกับของ Resend
5. ☐ รอ 5–30 นาที แล้วบอก Claude ว่า “ใส่ DNS แล้ว” 🤖 → Claude จะกด Verify ใน Resend และเช็กว่าผ่านครบ

> ทำไมใส่ที่ `send.` และ `resend._domainkey` — เพื่อไม่ชนกับ email forwarding เดิมของโดเมนหลัก

---

## ขั้น 2 — สร้าง Resend API key + เลือกแพ็กเกจ (👤 ~5 นาที)

1. ☐ https://resend.com/api-keys → **Create API Key**
   - Name: `mahidol-startup-club`
   - Permission: **Sending access**
   - Domain: **mahidolstartup.site** (จำกัดให้ส่งได้แค่โดเมนนี้ ปลอดภัยกว่า)
2. ☐ คัดลอก key (ขึ้นต้น `re_`) ไปใส่ใน `.env.local` บรรทัด `RESEND_API_KEY=` (แสดงครั้งเดียว ถ้าหายให้สร้างใหม่)
3. ☐ **ตัดสินใจเรื่องแพ็กเกจ** (บัญชีตอนนี้เป็น Free):

| แพ็กเกจ | ส่งได้ | ราคา | เหมาะกับ |
| --- | --- | --- | --- |
| Free (ตอนนี้) | **100 ฉบับ/วัน**, 3,000/เดือน | ฟรี | ทดสอบ / ผู้ใช้หลักสิบ |
| Pro | 50,000/เดือน **ไม่จำกัดรายวัน** | $20/เดือน | เปิดรับสมัครจริง ประกาศหาคนเป็นร้อย-พัน |

   - อีเมลรหัส 6 หลักตอนล็อกอิน **นับรวมโควตาเดียวกัน** — ถ้ามีคนสมัครพร้อมกันเกิน 100 คน/วัน บนแพ็กเกจ Free จะเริ่มล็อกอินด้วยอีเมลไม่ได้ (Google และรหัสผ่านยังใช้ได้)
   - ระบบคิวรองรับแล้ว: ถ้าโควตาเต็ม อีเมลแจ้งเตือนจะรอแล้วส่งต่อเองเมื่อโควตารีเซ็ต
   - อัปเกรดได้ที่ https://resend.com/settings/billing — **ไม่ต้องแก้โค้ด**

---

## ขั้น 3 — Supabase Access Token (👤 ~2 นาที) แล้วให้ Claude ตั้งค่า Supabase ทั้งหมด (🤖)

1. ☐ https://supabase.com/dashboard/account/tokens → **Generate new token** ชื่อ `msc-setup`
2. ☐ ใส่ใน `.env.local` บรรทัด `SUPABASE_ACCESS_TOKEN=`
3. ☐ บอก Claude ว่า “ทำขั้น 3 เสร็จแล้ว” 🤖 — Claude จะรัน `npm run supabase:auth` ซึ่งตั้งค่าครั้งเดียวครบ:
   - Site URL = เว็บจริง (แก้ปัญหาลิงก์ยืนยันอีเมลพาไป localhost) + Redirect URLs
   - ส่งอีเมลล็อกอินผ่าน Resend (`noreply@mahidolstartup.site`) แทนอีเมลในตัวของ Supabase
   - เทมเพลตอีเมลภาษาไทยพร้อมรหัส 6 หลัก (ไฟล์ใน `supabase/email-templates/`)
   - ขยาย rate limit อีเมล/OTP เป็น 2,000/ชม. และเปิด IP forwarding (นับ limit ต่อผู้ใช้จริง)
   - เปิด Google (ถ้าทำขั้น 4 แล้ว)
   - แล้วเพิ่ม `RESEND_API_KEY` ใน Vercel + deploy ใหม่
4. ☐ (หลังเสร็จ จะลบ `SUPABASE_ACCESS_TOKEN` ออกจาก `.env.local` หรือไปกด Revoke ที่หน้าเดิมก็ได้ — สร้างใหม่ได้เสมอเมื่อต้องตั้งค่าอีก)

> ทำขั้น 3 พร้อมขั้น 4 ได้ แล้วให้ Claude รันทีเดียว

---

## ขั้น 4 — ล็อกอินด้วย Google (👤 ~15 นาที)

1. ☐ https://console.cloud.google.com → มุมบนซ้าย **Select a project → New Project** ชื่อ `Mahidol Startup Club`
2. ☐ เมนู **APIs & Services → OAuth consent screen** (หรือ **Google Auth Platform**) → **Get started**
   - App name: `Mahidol Startup Club`
   - User support email: อีเมลของคุณ
   - Audience: **External**
   - Contact email: อีเมลของคุณ → **Create**
3. ☐ **Data Access / Scopes** — ไม่ต้องเพิ่ม (ใช้แค่ `email`, `profile`, `openid` ซึ่งเป็นค่าพื้นฐาน)
4. ☐ **Audience → Publish app** (เปลี่ยนจาก *Testing* เป็น *In production*)
   - ⚠️ ถ้าค้างไว้ที่ Testing จะล็อกอินได้แค่ test users ที่เพิ่มเองไม่เกิน 100 คน
   - scope พื้นฐานไม่ต้องรอ Google ตรวจสอบ
5. ☐ **Clients → Create client**
   - Application type: **Web application** · Name: `msc-web`
   - **Authorized JavaScript origins:** `https://mahidol-startup-club.vercel.app` และ `http://localhost:3000`
   - **Authorized redirect URIs:** `https://hxbpcnlxyigjfqmkgcku.supabase.co/auth/v1/callback`
   - กด **Create** → คัดลอก **Client ID** และ **Client secret**
6. ☐ ใส่ใน `.env.local` บรรทัด `GOOGLE_CLIENT_ID=` และ `GOOGLE_CLIENT_SECRET=`
7. ☐ บอก Claude 🤖 (รันสคริปต์ขั้น 3 ซ้ำเพื่อเปิด Google) — ปุ่ม **Continue with Google** จะขึ้นในหน้า `/login` เองภายใน 5 นาที

> หน้าเลือกบัญชีของ Google จะเขียนว่า “ไปยัง hxbpcnlxyigjfqmkgcku.supabase.co” — ปกติของแพ็กเกจฟรี ถ้าอยากให้เป็นชื่อโดเมนชมรม ต้องใช้ Supabase Custom Domain (add-on ~$10/เดือน)

---

## ขั้น 5 — LINE Official Account + Messaging API (👤 ~20 นาที) — จำเป็นสำหรับระบบ LINE ทั้งหมด

### 5.1 สร้าง / เตรียม OA
1. ☐ ถ้ายังไม่มี OA: https://manager.line.biz → **Create** → ชื่อ `Mahidol Startup Club` หมวดการศึกษา/ชมรม
   - ถ้ามี OA ของชมรมอยู่แล้ว ใช้ตัวเดิมได้เลย
2. ☐ ใน OA Manager → **Settings (ตั้งค่า) → Messaging API → Enable Messaging API**
   - ระบบให้เลือก/สร้าง **Provider** → ตั้งชื่อ `Mahidol Startup Club`
   - ⚠️ จำชื่อ Provider ไว้ — LINE Login (ขั้น 6) ต้องอยู่ Provider เดียวกัน
3. ☐ OA Manager → **Settings → Response settings (การตอบกลับ)**:
   - Chat: **ปิด** · Webhook: **เปิด** · Auto-response messages: **ปิด** · Greeting message: **ปิด**
   - เหตุผล: บอทของเว็บตอบเองทั้งหมด ทั้งข้อความต้อนรับ ลิงก์เชื่อมบัญชี และการค้นหาด้วย AI

### 5.2 คัดลอกค่าจาก LINE Developers
4. ☐ https://developers.line.biz/console → เลือก Provider → channel ของ OA (ประเภท Messaging API)
5. ☐ แท็บ **Basic settings** → **Channel secret** → ใส่ `.env.local` บรรทัด `LINE_MESSAGING_CHANNEL_SECRET=`
6. ☐ แท็บ **Messaging API**:
   - **Channel access token (long-lived)** → กด **Issue** → ใส่ `LINE_MESSAGING_ACCESS_TOKEN=`
   - **Bot basic ID** (เช่น `@123abcde`) → ใส่ `NEXT_PUBLIC_LINE_OA_ID=` (ใส่ `@` ด้วย)
   - **Webhook URL:** `https://mahidol-startup-club.vercel.app/api/line/webhook` → **Update**
   - **Use webhook:** เปิด
   - ⚠️ ปุ่ม **Verify** จะผ่านหลังจากขั้น 5.3 เท่านั้น เพราะต้องใส่ secret ใน Vercel ก่อน
7. ☐ ในแท็บเดียวกัน — **Allow bot to join group chats:** ปิด · **Auto-reply messages:** Disabled · **Greeting messages:** Disabled

### 5.3 ให้ Claude ทำต่อ 🤖
8. ☐ บอก Claude ว่า “ทำขั้น 5 เสร็จแล้ว” → Claude จะ:
   - เพิ่ม 3 ค่า LINE ใน Vercel แล้ว deploy ใหม่ (`NEXT_PUBLIC_LINE_OA_ID` ต้อง build ใหม่ถึงจะมีผล)
   - รัน `npm run line:richmenu` สร้างเมนูล่าง 3 ปุ่ม: งานแข่ง · เพื่อนร่วมทีม · ตั้งค่าแจ้งเตือน/เชื่อมบัญชี
9. ☐ กลับไปกด **Verify** ที่ Webhook URL → ต้องขึ้น **Success**

### 5.4 ค่าใช้จ่ายของ LINE (สำคัญ)
| แพ็กเกจ LINE OA (ไทย) | ข้อความ push/เดือน | ราคา |
| --- | --- | --- |
| Free | **300** | ฟรี |
| Basic | 15,000 | 1,280 บาท/เดือน |
| Pro | 35,000 | 1,780 บาท/เดือน |

- นับต่อคนรับ: ประกาศถึง 500 คน = 500 ข้อความ
- **ข้อความตอบกลับ (reply) ฟรีเสมอ** — การค้นหาด้วย AI ในแชต, ลิงก์เชื่อมบัญชี และปุ่มยอมรับ/ปฏิเสธ ไม่กินโควตา
- ที่กินโควตา: แจ้งเตือนคำชวนเข้าทีม, งานใหม่ที่ตรงกับคุณ, เตือนก่อนปิดรับ, ประกาศจากแอดมิน
- เมื่อโควตาเดือนนั้นหมด **ระบบส่งทางอีเมลแทนอัตโนมัติ** (คนที่มีอีเมลและเปิดรับไว้)
- แนะนำ: เริ่มแพ็กเกจ Free ถ้าคนเชื่อม LINE เกิน ~100 คนค่อยขึ้น Basic และใช้ “ประกาศข่าวสาร” แบบ “คนที่เปิดรับประกาศจากชมรม” แทน “ทุกคน” เพื่อประหยัด

---

## ขั้น 6 — LINE Login (👤 ~10 นาที · ไม่บังคับ แต่แนะนำ)

ไม่ทำก็เชื่อม LINE ได้ ด้วยการสแกน QR → ส่งรหัสในแชต แต่ถ้าทำ ปุ่ม “🔗 เชื่อมต่อ LINE” บนเว็บจะพาไปหน้ายืนยันของ LINE ได้ในแตะเดียว พร้อมชวนเพิ่มเพื่อน OA

1. ☐ https://developers.line.biz/console → Provider **เดียวกับ OA** → **Create a new channel → LINE Login**
   - Region: Thailand · Channel name: `Mahidol Startup Club` · App types: **Web app** · email: ของคุณ
2. ☐ แท็บ **LINE Login** → **Callback URL:** `https://mahidol-startup-club.vercel.app/api/auth/line/callback`
3. ☐ แท็บ **Basic settings**:
   - **Linked LINE Official Account** → เลือก OA จากขั้น 5
   - คัดลอก **Channel ID** → `LINE_LOGIN_CHANNEL_ID=`
   - คัดลอก **Channel secret** → `LINE_LOGIN_CHANNEL_SECRET=`
4. ☐ มุมบนของ channel เปลี่ยนสถานะจาก **Developing** เป็น **Published**
5. ☐ บอก Claude 🤖 → เพิ่มค่าใน Vercel + deploy

---

## ขั้น 7 — เนื้อหาและบัญชีแอดมิน (👤 ~15 นาที)

1. ☐ **ใส่ลิงก์สมัครให้ 4 งานตั้งต้น** (ตอนนี้ปุ่ม “สมัครเลย” ยังกดไม่ได้): `/admin/events` → ไอคอนดินสอ → ช่อง **ลิงก์สมัคร** → **อัปเดต**
   - Mahidol TED Youth Startup 2026
   - Talent Accelerator Program 2026
   - Mahidol Startup Thailand League 2026 (ปิดรับแล้ว — ใส่ลิงก์หรือย้ายเป็นฉบับร่างก็ได้)
   - Blue Horizon by iNT (ปิดรับแล้ว)
2. ☐ ตรวจงาน 9 งานจาก Hackza ที่อนุมัติไปแล้ว: เปิดดูหน้าจริงให้ลิงก์สมัครและวันปิดรับถูก
3. ☐ เลือก **ดาว ⭐ หน้าแรก** (สูงสุด 2 งาน) ที่ `/admin/events`
4. ☐ **บัญชีแอดมิน**
   - `admin@gmail.com` เป็นที่อยู่ Gmail ของคนอื่น — แนะนำให้แอดมินใช้อีเมลจริงของแต่ละคน
   - ตั้งแอดมินคนอื่นได้ที่ `/admin/users` → **ตั้งเป็นแอดมิน** (เขาต้องสมัครก่อน)
   - จากนั้นลบ `admin@gmail.com` ที่ Supabase → Authentication → Users
   - ถ้ายังใช้ต่อ ให้เปลี่ยนรหัสผ่านที่ Supabase → Authentication → Users → `...` → **Reset password / Update**
5. ☐ (ไม่บังคับ) เพิ่มอีเมลแอดมินถาวรใน Vercel → Project → Settings → Environment Variables → `ADMIN_EMAILS` (คั่นด้วย `,`) แล้ว redeploy — อีเมลในรายการนี้ได้สิทธิ์แอดมินอัตโนมัติเมื่อล็อกอิน

---

## ขั้น 8 — ตั้งค่าแนะนำเพื่อความเสถียร (👤 ~10 นาที)

1. ☐ **เชื่อม GitHub กับ Vercel** ให้ deploy อัตโนมัติทุกครั้งที่ push: https://vercel.com → project `mahidol-startup-club` → **Settings → Git → Connect Git Repository** → เลือก `Nontakorn-dev/Mahidol-Startup-Club` · Production Branch `main`
2. ☐ **เปิด 2FA** ทุกบัญชีที่คุมระบบ: GitHub, Vercel, Supabase, Resend, Google Cloud, LINE Business ID, OpenRouter, Namecheap
3. ☐ **OpenRouter**: https://openrouter.ai/settings/credits ตั้ง auto top-up หรือแจ้งเตือนเครดิตต่ำ (ค้นหา 1 ครั้ง ≈ $0.0004 — 10,000 ครั้ง ≈ $4) · ตั้ง **limit ต่อ key** ที่ https://openrouter.ai/settings/keys กันค่าใช้จ่ายบานปลาย
4. ☐ **Supabase Free จะหยุดโปรเจกต์อัตโนมัติถ้าไม่มีคนใช้ 7 วัน** — ช่วงปิดเทอมให้เข้าเว็บ/แดชบอร์ดบ้าง ถ้าโดนหยุด กด **Restore** ที่ dashboard ได้ทันที (ข้อมูลไม่หาย) · ถ้าเป็นระบบหลักของชมรมระยะยาว พิจารณา Pro $25/เดือน (ไม่หยุด + มี backup)
5. ☐ **ตั้งเตือนค่าใช้จ่าย** ที่ Vercel (Settings → Billing → Spend Management) — แพ็กเกจ Hobby ฟรีและหยุดเองถ้าเกินโควตา ไม่มีบิลแอบเกิด

---

## ขั้น 9 — (ไม่บังคับ) ใช้โดเมน mahidolstartup.site กับตัวเว็บ

ทำให้ลิงก์เป็น `https://mahidolstartup.site` แทน `vercel.app` ดูน่าเชื่อถือขึ้น และตรงกับโดเมนผู้ส่งอีเมล

1. ☐ บอก Claude “ผูกโดเมนกับเว็บ” 🤖 → Claude เพิ่มโดเมนใน Vercel และบอกค่า DNS
2. ☐ 👤 ที่ Namecheap Advanced DNS:
   - **ลบ** แถว parking/URL redirect เดิมของ `@`
   - เพิ่ม `A Record` Host `@` และ `CNAME` Host `www` ตามที่ Vercel ให้
   - **ห้ามลบ** แถวอีเมลจากขั้น 1
3. ☐ เมื่อโดเมนใช้ได้ ต้องเปลี่ยน URL ใน **7 จุด** (🤖 ทำให้ได้ทั้งหมด ยกเว้นข้อที่บอก):
   1. Vercel env `NEXT_PUBLIC_SITE_URL` + redeploy
   2. Supabase Site URL (รันสคริปต์ขั้น 3 ด้วย `AUTH_SITE_URL=https://mahidolstartup.site`)
   3. 👤 Google Cloud: เพิ่ม Authorized JavaScript origin `https://mahidolstartup.site`
   4. 👤 LINE Messaging API: Webhook URL
   5. 👤 LINE Login: Callback URL
   6. Supabase cron 2 jobs (`hackza-sync`, `email-outbox`) ที่เรียก URL เว็บ
   7. Rich menu (รันสคริปต์ใหม่)

---

## ขั้น 10 — ทดสอบรับมอบงาน (ทำหลังขั้น 1–6 เสร็จ)

ใช้มือถือ 1 เครื่อง + คอม 1 เครื่อง และอีเมลจริงที่ยังไม่เคยสมัคร

**ล็อกอิน**
- ☐ คอม: `/login` → **Continue with Google** → เลือกบัญชี → กลับมาหน้ากรอกโปรไฟล์ → ชื่อและรูปจาก Google ขึ้นอัตโนมัติ
- ☐ คอม (หน้าต่างไม่ระบุตัวตน): อีเมลใหม่ → **รับรหัสทางอีเมล** → อีเมลมาจาก `noreply@mahidolstartup.site` ภายใน 1 นาที และอยู่ใน Inbox (ไม่ใช่ Spam) → กรอกรหัส → เข้าได้
- ☐ กดปุ่มในอีเมลแทนการกรอกรหัส → เข้าได้เช่นกัน
- ☐ อีเมล `@student.mahidol.ac.th` → โปรไฟล์ขึ้นป้าย **Mahidol verified**

**LINE**
- ☐ มือถือ: เพิ่มเพื่อน OA → บอทส่งข้อความต้อนรับพร้อมปุ่ม **เชื่อมบัญชี**
- ☐ กด **เชื่อมบัญชี** → สมัครด้วยอีเมล (กรอกรหัส 6 หลักในแอป LINE ได้เลย) → หน้ายืนยันของ LINE → กดยืนยัน → บอทตอบ “เชื่อมบัญชีสำเร็จ 🎉”
- ☐ คอม: บัญชีอื่น → `/me` → **🔗 เชื่อมต่อ LINE** → สแกน QR → ส่งข้อความรหัสในแชต → หน้าเว็บเปลี่ยนเป็น “เชื่อม LINE แล้ว ✓” เอง
- ☐ ในแชต LINE พิมพ์ “หาทีมลง TED Youth ฉันทำ UX ได้” → ได้การ์ดงานพร้อมเหตุผล “แนะนำเพราะ…”
- ☐ เมนูล่าง 3 ปุ่มกดได้ครบ

**แจ้งเตือน**
- ☐ บัญชี A ชวนบัญชี B เข้าทีม → B ที่เชื่อม LINE ได้ข้อความใน LINE ทันที → กด **ตอบรับ** ในแชตได้
- ☐ บัญชีที่ไม่เชื่อม LINE ได้อีเมลแทน → ในอีเมลกด **ยกเลิกรับอีเมล** ได้
- ☐ แอดมิน → `/admin/broadcasts` → ส่งประกาศทดสอบ (เลือก “คนที่บันทึกงาน…” เพื่อจำกัดผู้รับ) → คนเชื่อม LINE ได้ทาง LINE · คนอื่นได้อีเมล

**แอดมิน**
- ☐ `/admin/imports` → **ซิงก์ตอนนี้** → ขึ้นผลการดึง (กดได้ 1 ครั้ง/10 นาที)
- ☐ เพิ่มงานใหม่พร้อมโปสเตอร์ → เผยแพร่ → ขึ้นหน้า `/opportunities` ทันที

---

## สรุปค่าใช้จ่าย

| บริการ | ตอนนี้ | เมื่อคนใช้เยอะ |
| --- | --- | --- |
| Vercel (โฮสต์เว็บ) | Hobby ฟรี | ฟรีต่อได้ (Pro $20 ถ้าต้องการ cron ถี่/ทีมหลายคน) |
| Supabase (ฐานข้อมูล+ล็อกอิน) | Free — 50,000 ผู้ใช้/เดือน | Pro $25 เมื่อต้องการ backup / ไม่ถูกหยุด |
| Resend (อีเมล) | Free 100/วัน | Pro $20 → 50,000/เดือน |
| LINE OA | Free 300 push/เดือน | Basic 1,280 บาท → 15,000 |
| OpenRouter (AI) | จ่ายตามใช้ ~$0.0004/ครั้ง | ~$4 ต่อ 10,000 ครั้ง |
| Google login | ฟรี | ฟรี |
| โดเมน | จ่ายแล้วที่ Namecheap | ต่ออายุรายปี |

**เริ่มต้นได้ด้วย $0/เดือน** · เมื่อเปิดรับสมัครจริงจัง แนะนำ Resend Pro ($20) ก่อนอย่างอื่น

---

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
| --- | --- |
| ลิงก์ในอีเมลยืนยันพาไป `localhost` | ยังไม่ทำขั้น 3 (Site URL) |
| “มีการขอถี่เกินไป” ตอนขอรหัสอีเมล | ขอรหัสซ้ำภายใน 1 นาที หรือยังใช้อีเมลในตัวของ Supabase (ทำขั้น 3) |
| อีเมลไม่มา / ตก Spam | DNS ขั้น 1 ยังไม่ verify · ดูสถานะที่ https://resend.com/domains · ดูโควตาที่ https://resend.com/settings/usage |
| ปุ่ม Google ไม่ขึ้น | ยังไม่เปิด Google ใน Supabase (ขั้น 4.7) หรือรอแคช 5 นาที |
| Google ขึ้น `disallowed_useragent` | เปิดจากในแอป Facebook/IG — เปิดใน Safari/Chrome (ในแอป LINE ระบบเปิดให้อัตโนมัติ) |
| Google ขึ้น “Access blocked / app not verified” | ยังไม่กด **Publish app** (ขั้น 4.4) |
| `redirect_uri_mismatch` | Redirect URI ใน Google Cloud ต้องเป็น `https://hxbpcnlxyigjfqmkgcku.supabase.co/auth/v1/callback` ตรงตัวอักษร |
| เพิ่มเพื่อน OA แล้วบอทไม่ตอบ | Webhook ปิดอยู่ / URL ผิด / ยังไม่ deploy ค่า LINE (ขั้น 5.3) · กด Verify ที่ LINE Developers |
| บอทตอบซ้ำ 2 ข้อความ | Auto-response หรือ Greeting ของ OA ยังเปิดอยู่ (ขั้น 5.1 ข้อ 3) |
| LINE ไม่ได้รับแจ้งเตือนแต่ได้อีเมลแทน | ยังไม่เพิ่มเพื่อน OA หรือโควตา push เดือนนี้หมด (ขั้น 5.4) |
| เข้าเว็บแล้ว error ทั้งหมด | Supabase Free ถูกหยุดเพราะไม่มีคนใช้ 7 วัน → dashboard กด **Restore** |
| แอดมินเข้า `/admin` ไม่ได้ | บัญชียังเป็น user → ตั้งสิทธิ์ที่ `/admin/users` หรือเพิ่มอีเมลใน `ADMIN_EMAILS` |

---

## สิ่งที่ทำงานอัตโนมัติอยู่แล้ว (ไม่ต้องทำอะไร)

- ดึงงานจาก Hackza ทุก 6 ชม. (Supabase pg_cron `hackza-sync`) → รอแอดมินอนุมัติ
- ส่งอีเมลค้างในคิวทุกนาที (pg_cron `email-outbox` ทำงานเฉพาะตอนมีคิว)
- ทุกวัน 08:00 น.: เตือนงานที่บันทึกไว้ก่อนปิดรับ 3 วัน + ส่งสรุปรายวัน (Vercel Cron `/api/cron/daily`)
- ย้ายงานที่รอตรวจแต่หมดเขตไปเป็น “หมดเวลา”, ล้างแคชคำค้น AI ที่เก่าเกิน 2 วัน

รายละเอียดเชิงเทคนิค (โครงสร้างโค้ด, ความปลอดภัย, การ scale) อยู่ใน `README.md`
