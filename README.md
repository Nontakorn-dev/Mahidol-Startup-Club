# Mahidol Startup Club

เว็บช่วยนักศึกษาหางานแข่ง ทุน ทีม และ co-founder — พิมพ์ความต้องการเป็นประโยค แล้ว DeepSeek (ผ่าน OpenRouter) แปลงเป็นตัวกรองและพาไปหน้าที่ใช่ บัญชีผู้ใช้เป็น **อีเมล** เสมอ แล้ว **เชื่อม LINE** ภายหลังเพื่อรับข่าวสารผ่าน LINE OA (คนที่ไม่เชื่อมได้รับทางอีเมล)

- Production: https://mahidolstartup.site (ที่อยู่เดิม mahidol-startup-club.vercel.app เด้งมาที่นี่ ยกเว้น /api)
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
| บัญชี | `/login` (Google · อีเมลรหัส 6 หลัก/ปุ่มในอีเมล · รหัสผ่าน), `/onboarding`, `/me` (🔗 เชื่อมต่อ LINE), `/u/[id]`, `/settings/notifications` (เชื่อม/ยกเลิก LINE, หัวข้อแจ้งเตือน, ความถี่) |
| แอดมิน | `/admin` ภาพรวม · `/admin/imports` ตรวจงานที่ดึงจาก Hackza · Contester · CAMPHUB · DekPort · Devpost · `/admin/events` เพิ่ม/แก้งาน + พรีวิว + ดาวหน้าแรก · `/admin/community` ตรวจ/ลบโพสต์ · `/admin/users` ตั้งแอดมิน/ระงับ · `/admin/broadcasts` ส่งประกาศ LINE + อีเมล |
| LINE OA | webhook: follow/unfollow, account link, ปุ่ม “ยอมรับ/ปฏิเสธ” ในแชต, พิมพ์ประโยคในแชตแล้ว AI ตอบเป็นการ์ดงาน, rich menu |

### การเชื่อม LINE (Email User ID ↔ LINE User ID)

LINE ไม่ใช่ช่องทางล็อกอิน — ใช้เพื่อผูกกับบัญชีอีเมลและรับข่าวสารเท่านั้น

1. **เริ่มจากเว็บ**: สมัคร/ล็อกอินด้วยอีเมล → `/me` → 🔗 เชื่อมต่อ LINE
   - ถ้ามี LINE Login channel: ปุ่มพาไปหน้ายืนยันของ LINE (พร้อมเพิ่มเพื่อน OA) → กลับมาที่เว็บ เชื่อมแล้ว
   - หรือสแกน QR / กดเปิดแชต: LINE เปิดแชต OA พร้อมข้อความ `เชื่อมบัญชี ABC123` (รหัสใช้ครั้งเดียว 15 นาที) → กดส่ง → webhook ผูกบัญชี → หน้าเว็บรีเฟรชเอง
2. **เริ่มจาก LINE OA** (LINE Account Link): เพิ่มเพื่อน / กดเมนู “ตั้งค่าแจ้งเตือน” / พิมพ์ “เชื่อมบัญชี” → บอทส่งลิงก์เฉพาะ (`/line/link?linkToken=…`, 10 นาที) → เว็บ → สมัคร/ล็อกอินด้วยอีเมล (กรอกรหัส 6 หลักได้ในเบราว์เซอร์ของ LINE เลย) → ระบบพาไปหน้ายืนยันของ LINE ทันที → webhook `accountLink` ผูกบัญชี → บอทแจ้งว่าเชื่อมสำเร็จ และชวนกรอกโปรไฟล์ต่อ

ช่องทางแจ้งเตือน: ผูก LINE + เป็นเพื่อน OA → ส่ง LINE · ไม่เช่นนั้น → อีเมล (ถ้าเปิดรับ) · เลือก “สรุปวันละครั้ง” ได้ (cron ทุกวัน 08:00 น.)

แอดมิน: อีเมลใน `ADMIN_EMAILS` ได้สิทธิ์แอดมินอัตโนมัติเมื่อล็อกอิน หรือตั้งจาก `/admin/users`

## วันปิดรับและนับถอยหลัง

- ทุกงานเก็บ **เวลาปิดรับจริง** (`events.deadline_at`, เวลาไทย เช่น 12:00 / 16:30 / 20:00 น.) — ถ้าไม่ใส่เวลา ถือว่าปิด 23:59 น. · trigger ใน DB ทำให้ `deadline` (วันที่) ตรงกับ `deadline_at` เสมอ
- ป้ายนับถอยหลังสด (`DeadlineBadge`): แดง ≤ 24 ชม. · ส้ม ≤ 3 วัน · เหลือง ≤ 7 วัน · ชั่วโมงสุดท้ายนับเป็นวินาที
- `/opportunities` เรียงตามเวลาปิดจริง มีแถบ “ใกล้ปิดรับใน 7 วัน”, มุมมอง เพิ่มล่าสุด / **ปฏิทินปิดรับ** (`?view=calendar`), ตัวกรอง ปิดใน 7/30 วัน · ร่วมออนไลน์ได้ · แสดงงานที่ปิดแล้ว
- หน้ารายละเอียดมีวันจัดกิจกรรม รูปแบบ/สถานที่ และปุ่มเพิ่มวันปิดรับลง Google Calendar / ไฟล์ `.ics` (เตือนก่อน 3 วันและ 3 ชม.)
- แอดมินกรอกวัน+เวลาปิดรับ วันจัดกิจกรรม รูปแบบ และสถานที่ได้ในหน้าแก้ไขงาน

## เพิ่มงานแบบคัดเอง (bulk)

ข้อมูลที่ตรวจสอบจากหน้าทางการแล้วอยู่ใน `scripts/data/opportunities-*.json` (มีลิงก์แหล่งที่มาทุกงาน) → `node --env-file=.env.local scripts/apply-opportunities.mjs scripts/data/opportunities-2026-10.json` — เผยแพร่ทันที (ไม่ยิงแจ้งเตือนทีละงาน), คัดลอกโปสเตอร์มาเก็บใน bucket `posters` ของเรา, รันซ้ำได้ (upsert ตาม slug)

## ค้นหาด้วยประโยค (เร็ว · ประหยัด · กันข้อความไม่เหมาะสม)

```
ข้อความ → guard (ทำความสะอาด, ลบอีเมล/เบอร์/เลขบัตร/ลิงก์, บล็อกคำหยาบ/ผิดกฎหมาย/นอกเรื่อง/prompt injection) — ไม่เสีย token
       → cache (หน่วยความจำ → ตาราง search_cache 7 วัน)
       → กฎภาษา (คำค้นสั้น/ชัด เช่น “ทุน”, “GSEA”, “หา dev เข้าทีม”, “workshop ใกล้ปิด”) — ไม่เสีย token
       → โมเดลภาษา เฉพาะประโยคที่ซับซ้อน: prompt คงที่ ~580 token (provider cache ได้), ตอบ JSON key สั้น ~10–50 token
       → จับคู่ชื่องานกับงานที่เผยแพร่อยู่ “ตอนนี้” ในเครื่องเอง → ค้นใน DB
```

- **งานใหม่ match ได้ทันที**: ไม่ส่งรายชื่องานให้โมเดลอีกแล้ว (เดิมส่งแค่ 80 งานแรก) โมเดลแค่บอก “ชื่องานที่ผู้ใช้พูดถึง” แล้ว `resolveEvent()` เทียบกับงานที่เผยแพร่ล่าสุด (ชื่อ, คำเฉพาะ, ตัวย่อ เช่น GSEA) — cache เก็บผลของโมเดล ไม่ใช่ slug จึงจับคู่กับงานที่เพิ่งอนุมัติได้เสมอ
- **ต้นทุน/ความเร็ว** (วัดจริง ต.ค. 2569): เดิม ~1,150 + 780 token/ครั้ง ~5 วินาที + เรียกซ้ำอีกครั้งเพื่อเขียน “แนะนำเพราะ” → ตอนนี้ ~580 (cache 512) + 8–50 token ~0.6–1.5 วินาที และคำค้นส่วนใหญ่ไม่เรียกโมเดลเลย · เหตุผล “แนะนำเพราะ” และสรุป “เข้าใจว่าคุณกำลัง…” สร้างจากกฎในเครื่อง
- **เสถียร**: timeout 6 วินาที → ใช้ผลจากกฎแทนทันที · ล้ม 2 ครั้งติดหยุดเรียกโมเดล 1 นาที · จำกัด 8 ครั้ง/นาที/คน · เพดานรายวัน `AI_DAILY_LIMIT` (ค่าเริ่ม 2000 ครั้ง) เกินแล้วใช้กฎ
- `search_logs.engine` บอกว่าแต่ละคำค้นตอบด้วยอะไร (guard/cache/rules/llm/fallback) — ดูว่าคำไหนควรเพิ่มเป็นกฎได้
- **หัวข้อ & เงื่อนไข** (`src/lib/topics.ts` — ใช้ทั้งตอนอ่านคำค้นและตอนจับคู่งาน): ~30 หัวข้อ (การแพทย์, AI, เขียนโปรแกรม, ออกแบบ, การตลาด, ธุรกิจ, หุ่นยนต์, สิ่งแวดล้อม, พลังงาน, อาหาร, การศึกษา, fintech, social impact, เมือง, เกม, … + จุฬาฯ/มหิดล/NIA/TED Fund) แต่ละหัวข้อมีคำที่ใช้ตรวจในประโยคและคำที่ใช้หาในงาน · เงื่อนไขงาน: ออนไลน์ / ออนไซต์ / กรุงเทพฯ / ต่างประเทศ / ฟรี / รางวัลสูง (เรียงตามเงินรางวัล)
  - หัวข้อ + ประเภทต้องตรงทั้งคู่ (“ทุน” + “AI” = ทุนด้าน AI) ถ้าไม่มี จะแสดงงานที่ใกล้เคียงพร้อมบอกว่า “ยังไม่มีทุนเรื่อง AI ที่เปิดอยู่”
  - คำที่เป็นทั้งทักษะและหัวข้อ (AI, ออกแบบ, การตลาด, หมอ…) จะเป็น “ทักษะของผู้ใช้” เฉพาะเมื่อพูดถึงคน (“ฉันทำ AI ได้”, “ขาด designer”) นอกนั้นเป็นหัวข้อ (“งานด้าน AI”, “หาทุนทำ AI”)
  - คำไทยไม่มีเว้นวรรค จึงต้องใช้คำเฉพาะ (เช่น “การพัฒนาเมือง” ไม่ใช่ “เมือง”) · คำอังกฤษสั้นต้องตรงทั้งคำ (“app” ไม่โดน “apply”) · ไม่ใช้ tag อัตโนมัติของงานในการจับหัวข้อ
  - เพิ่มหัวข้อใหม่: เพิ่ม 1 บรรทัดใน `TOPICS` ทั้งฝั่งอ่านคำค้นและจับคู่งานจะรู้จักทันที (ไม่ต้องแก้ prompt)
- หน้าเว็บไม่ระบุชื่อผู้ให้บริการโมเดล

## ดึงงานอัตโนมัติจากหลายแหล่ง (แอดมินตรวจก่อนเผยแพร่เสมอ)

```
ทุกชั่วโมง (Supabase pg_cron `imports-sync`) → /api/cron/imports → ซิงก์แหล่งที่ถึงรอบ (แต่ละแหล่ง ~ทุก 6 ชม.)
→ คัดเฉพาะสาย startup · นวัตกรรม · workshop · ธุรกิจ ที่นักศึกษามหาวิทยาลัยสมัครได้
→ event_imports: pending (รอตรวจ) / duplicate (งานเดียวกันจากเว็บอื่น) / skipped (ตัวกรองข้าม)
→ /admin/imports → อนุมัติ & เผยแพร่ / แก้ไขก่อนเผยแพร่ / ไม่เอา → นักศึกษาเห็น (+ แจ้งเตือนคนที่สนใจ)
```

| แหล่ง | ดึงอย่างไร (ตรวจ robots.txt แล้ว) | ความน่าเชื่อถือ |
|---|---|---|
| [Hackza](https://www.hackza.org/hackathons) | ไม่มี Public API, robots ห้าม `/api/` → อ่านหน้า `/hackathons` หน้าเดียว (ข้อมูลฝังใน RSC payload) | สูง · มีเวลาปิดรับแม่นยำ |
| [Contester.Life](https://contester.life) | robots ห้าม `/api/` → หน้าแรก (10 งานล่าสุด ข้อมูลครบ) + `sitemap.xml` → หน้างานที่ใหม่/แก้ไข (schema.org Event) ไม่เกิน 15 หน้า/รอบ | กลาง · ชมรม/ผู้จัดโพสต์เอง บางงานรับเฉพาะนิสิตมหาลัยผู้จัด (ติดธงให้) |
| [CAMPHUB](https://www.camphub.in.th) | WordPress REST API สาธารณะ (กรองแท็ก ปริญญาตรี/บุคคลทั่วไป ไม่เอา timeout) → เปิดหน้าโพสต์เฉพาะที่ดูเกี่ยวข้อง ไม่เกิน 12 หน้า/รอบ | สูง · ทีมงานเขียนเอง วันปิดรับ/ผู้จัด/คุณสมบัติครบ |
| [DekPort](https://dekport.com/competitions) | robots อนุญาต `/competitions/*` → หน้าหมวด business + technology → หน้างานไม่เกิน 10 หน้า/รอบ | กลาง · เคยลงวันผิด → ติดธง “ตรวจกับประกาศทางการ” ทุกงาน |
| [Devpost](https://devpost.com/hackathons) | JSON สาธารณะ `/api/hackathons` (robots อนุญาตทั้งหมด) · เฉพาะงานออนไลน์ มีเงินรางวัล ผู้ลงทะเบียน ≥ 500 · ถ้าหน้างานไม่อนุญาตบอทจะใช้ข้อมูลจากรายการแทน | สูง · ผู้จัดลงเอง (ระดับโลก) |

- **มารยาทในการดึง** (`src/lib/importers/http.ts`): User-Agent ระบุตัวตน `MahidolStartupClubBot` + ลิงก์ติดต่อ · อ่าน robots.txt ทุกรอบ (รองรับ `*`, `$`, กลุ่ม user-agent) · ทีละ request เว้น 0.8 วินาที · โดน 403/429/503 หรือหน้า challenge → หยุด ไม่ bypass Cloudflare/CAPTCHA ใด ๆ · หน้าที่ไม่เปลี่ยน (ดูจาก lastmod/modified) ไม่ดึงซ้ำ · ปุ่มซิงก์มือ ≤ 1 ครั้ง/10 นาที/แหล่ง
- **บั๊ก “รายละเอียดเป็น $2c”**: Next.js ย้ายข้อความยาวไปเป็น text row (`2c:T5a3,…`) แล้วเหลือ `"$2c"` ใน JSON — ตัวเก่าใช้ regex หา row จึงอ่าน id ผิดเมื่อข้อความก่อนหน้าลงท้ายด้วยตัวเลข (“…2569” + “29:T…” → `6929`) ตอนนี้ `src/lib/importers/rsc.ts` อ่าน payload ทีละ row ตามความยาว byte จริง และ `cleanValue()` ทิ้งค่าที่ยังเป็น `$xx` เสมอ
- **คัดกรอง** (`relevance.ts`): ระดับการศึกษาจากแหล่ง (หรือเดาจากข้อความ) — ม.ปลายอย่างเดียวตัดทิ้ง · คะแนนคำสำคัญ startup/ผู้ประกอบการ/ธุรกิจ/นวัตกรรม/pitch/บ่มเพาะ (ชื่อหนัก) + workshop/hackathon/AI/สุขภาพ/ยั่งยืน · ตัดสายภาพยนตร์/ดนตรี/อาสา/ติวสอบ/open house · `RELEVANCE_THRESHOLD = 4`
- **กันซ้ำข้ามเว็บ** (`sync.ts`): ชื่อเหมือน/ครอบกัน, คำเฉพาะตรงกัน, ตัวย่อ (GSEA ↔ Global Student Entrepreneur Awards), ลิงก์สมัครเดียวกัน, หรือหน้าเดียวกับงานที่ลงไว้แล้ว (วันปิดห่างกันไม่เกิน 45 วัน) → เป็น `duplicate` ของรายการแรก การ์ดรายการหลักจะบอก “พบในแหล่งอื่นด้วย” และเตือนถ้า **วันปิดรับไม่ตรงกัน**
- **หน้าแอดมิน** แสดงสถานะซิงก์ของแต่ละแหล่ง + เช็กลิสต์ความน่าเชื่อถือต่อการ์ด (ลิงก์สมัครของผู้จัด / เวลาปิดชัดเจน / พบกี่แหล่ง / ธงเตือน) · แท็บ “ข้ามอัตโนมัติ” ให้กู้งานที่ตัวกรองพลาด · อนุมัติแล้วระบบคัดลอกโปสเตอร์มาเก็บใน bucket ของเรา
- การตัดสินใจอนุมัติ/ไม่เอาจะไม่ถูกเขียนทับ (อัปเดตเฉพาะ snapshot) · งานในคิวที่เลยวันปิด → หมดเวลา · รายการที่ถูกข้ามจะถูกลบเองเมื่อแหล่งไม่แสดงแล้ว 30 วัน
- ทดลองแบบไม่เขียนฐานข้อมูล: `npx tsx --conditions=react-server --env-file=.env.local scripts/dev/try-sources.mts [hackza contester …]` · ซิงก์จริงจากเครื่อง: `scripts/dev/sync.mts [--refresh] [แหล่ง…]`
- ตัวตั้งเวลา: Vercel Hobby รัน cron ได้วันละครั้ง จึงใช้ Supabase pg_cron + pg_net (token ใน Vault ชื่อ `hackza_cron_token`) และมี Vercel cron วันละครั้งเป็นสำรอง · ถ้าเปลี่ยนโดเมน แก้ URL ใน job `imports-sync` (`supabase/migrations/0010_multi_source_imports.sql`)
- เพิ่มแหล่งใหม่: เขียน adapter ใน `src/lib/importers/sources/` ให้คืน `SourceItem` แล้วใส่ใน `SOURCES` (`sync.ts`)

## รองรับผู้ใช้จำนวนมากในต้นทุนต่ำ

| ส่วน | ทำอย่างไร |
| --- | --- |
| ล็อกอิน (อีเมลรหัส 6 หลัก · รหัสผ่าน · Google) | เรียก Supabase Auth **จากเบราว์เซอร์ผู้ใช้** — rate limit ของ Supabase นับต่อ IP จึงไม่ไปชนกันที่ IP ของ Vercel · Google กลับมาที่ `/login?code=` แล้วเบราว์เซอร์สร้างเซสชันเอง (PKCE) |
| ตรวจเซสชันทุกหน้า | `getClaims()` ตรวจ JWT (ES256) ในเครื่อง ไม่ยิง Auth ทุก request · proxy ข้ามทันทีถ้าไม่มีคุกกี้ session · การ refresh จาก server ส่ง IP จริงผ่าน `sb-forwarded-for` |
| หน้าเว็บสาธารณะ | รายการงานแคช 60 วินาที (`unstable_cache` tag `events`) และล้างทันทีเมื่อแอดมินแก้ |
| อีเมลจำนวนมาก | คิว `notifications` (`status=queued`) → worker ส่งทีละ 100 ฉบับ/คำขอ (Resend batch, ≤ ~6 คำขอ/วินาที, Idempotency-Key กันส่งซ้ำ) · ส่งทันทีถ้าน้อย ที่เหลือ pg_cron ทยอยส่งทุกนาที (`email-outbox`, ทำงานเฉพาะตอนมีคิว) · ชนโควตา Resend → หยุดรอรอบโควตาใหม่อัตโนมัติ · retry แบบ backoff |
| ส่งถึง inbox ไม่ตก spam | โดเมนของเราเอง (SPF/DKIM/DMARC) · ปิด click tracking (ไม่ทำลายลิงก์ล็อกอิน) · `List-Unsubscribe` + one-click (`/api/email/unsubscribe`) ตามกฎ Gmail/Yahoo |

ต้นทุนโดยประมาณ: Vercel Hobby ฟรี · Supabase Free (50,000 MAU) · Resend Free 100 ฉบับ/วัน (3,000/เดือน) → Pro $20/เดือน 50,000 ฉบับ ไม่จำกัดรายวัน · อีเมลล็อกอินของ Supabase ก็ส่งผ่าน Resend และนับรวมโควตาเดียวกัน

## Google + อีเมล (ตั้งค่าครั้งเดียว)

1. **DNS ที่ Namecheap** (Domain List → mahidolstartup.site → Advanced DNS → Add new record) — ค่าดูได้ที่ Resend → Domains → mahidolstartup.site; เพิ่ม `_dmarc` TXT `v=DMARC1; p=none;` ด้วย แล้วกด Verify ใน Resend
2. **Google Cloud Console** → APIs & Services → OAuth consent screen (External) → Credentials → Create OAuth client ID (Web application)
   - Authorized JavaScript origins: `https://mahidolstartup.site`
   - Authorized redirect URI: `https://hxbpcnlxyigjfqmkgcku.supabase.co/auth/v1/callback`
3. ใส่ใน `.env.local`: `SUPABASE_ACCESS_TOKEN` (supabase.com/dashboard/account/tokens), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY` (Resend → API Keys, สิทธิ์ Sending access โดเมน mahidolstartup.site)
4. รัน `npm run supabase:auth` — ตั้งค่า Site URL/Redirect URLs, SMTP ผ่าน Resend, เทมเพลตอีเมลภาษาไทยพร้อมรหัส 6 หลัก (`supabase/email-templates/`), rate limit, IP forwarding และเปิด Google ในครั้งเดียว (รันซ้ำได้)
5. `npx vercel env add RESEND_API_KEY production` แล้ว `npx vercel deploy --prod` — ปุ่ม “Continue with Google” จะแสดงเองเมื่อเปิด provider แล้ว

หมายเหตุ: Google ไม่อนุญาตล็อกอินในเบราว์เซอร์ในแอป (LINE/Facebook) — ใน LINE ปุ่มจะเปิดหน้าใน Safari/Chrome ให้อัตโนมัติ (`openExternalBrowser=1`) หรือใช้รหัส 6 หลักทางอีเมลได้เลย

## ⚠️ สิ่งที่ต้องตั้งค่าเพิ่ม

### 1. Supabase Auth URL (จำเป็นสำหรับลิงก์อีเมล)
Dashboard → Authentication → URL Configuration
- **Site URL**: `https://mahidolstartup.site`
- **Redirect URLs**: `https://mahidolstartup.site/**`, `https://mahidol-startup-club.vercel.app/**` และ `http://localhost:3000/**`

**Email Templates** (Authentication → Email Templates) — ทั้ง “Magic Link” และ “Confirm signup” ให้ใส่
- รหัส 6 หลัก `{{ .Token }}` — ผู้ที่สมัครจากในแอป LINE กรอกรหัสได้โดยไม่ต้องสลับแอป
- ลิงก์ `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` — เปิดได้ทุกเบราว์เซอร์และพากลับไปทำต่อ (รวมถึงการเชื่อม LINE)

อีเมลระบบของ Supabase ส่งได้ไม่กี่ฉบับต่อชั่วโมง — ใช้งานจริงให้ตั้ง Custom SMTP (Authentication → SMTP Settings) ด้วย Resend: host `smtp.resend.com`, port `465`, user `resend`, password = Resend API key

### 2. LINE Official Account
1. **Messaging API channel (จำเป็น)** — LINE Official Account Manager → Settings → Messaging API → เลือก Provider
   - Channel secret → `LINE_MESSAGING_CHANNEL_SECRET`
   - Messaging API → Channel access token (long-lived) → `LINE_MESSAGING_ACCESS_TOKEN` (ใช้ทั้งส่งข้อความและออก linkToken สำหรับ account link)
   - Webhook URL: `https://mahidolstartup.site/api/line/webhook` → เปิด **Use webhook**
   - ปิด Auto-reply messages และ Greeting messages (บอทตอบเอง)
   - Basic ID ของ OA (เช่น `@mahidolstartup`) → `NEXT_PUBLIC_LINE_OA_ID` (ใช้สร้าง QR / ลิงก์เปิดแชตพร้อมรหัส)
2. **LINE Login channel (ไม่บังคับ)** — ทำให้ปุ่ม “เชื่อมต่อ LINE” บนเว็บไปหน้ายืนยันของ LINE โดยตรง (ไม่มีก็ใช้ QR/รหัสแทนได้)
   - ต้องอยู่ **Provider เดียวกับ OA** (LINE User ID จึงตรงกัน)
   - Channel ID / secret → `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`
   - Callback URL: `https://mahidolstartup.site/api/auth/line/callback`
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
src/lib/ai/intent.ts   แปลงประโยคค้นหาเป็นตัวกรอง (guard → cache → rules → model) · src/lib/ai/guard.ts กรองข้อความไม่เหมาะสม
src/lib/search.ts      query builder + จัดอันดับ + เหตุผล
src/lib/notify.ts      dispatcher LINE → อีเมล → digest
src/lib/line/          การเชื่อมบัญชี (link.ts), LINE Login consent, Messaging API + Flex builders
src/lib/data/          อ่านข้อมูล + ซ่อนตัวตนโพสต์ไม่ระบุชื่อ
supabase/migrations/   schema, RLS, storage buckets, seed
scripts/               สคริปต์สร้าง LINE rich menu
```

ความปลอดภัย: ทุกตารางเปิด RLS ฝั่ง client อ่านได้เฉพาะงานที่เผยแพร่ โปรไฟล์ตัวเอง และบทสนทนาที่ตัวเองอยู่ (สำหรับ realtime) การเขียนทั้งหมดผ่าน server ด้วย service role หลังตรวจสิทธิ์ โพสต์ไม่ระบุชื่อจะไม่ส่ง id เจ้าของไปที่ browser (แม้แต่แอดมินก็ไม่เห็นชื่อ)
