-- Card subtitle shown on the home page ("ทุนพัฒนาไอเดียและต้นแบบสูงสุด 1.5 ล้านบาท")
alter table public.events add column if not exists summary text;

-- The four opportunities shown in the design export. Apply links were placeholders
-- (forms.gle/xxxxxxxx) in the design, so they start empty — admins fill them in.
insert into public.events (slug, title, category, poster_url, organizer, summary, benefit, eligibility, overview, deadline, open_note, tags, status, is_club, featured, allow_teams, notify_on_publish, published_at)
values
('talent-accelerator-2026', 'Talent Accelerator Program 2026', 'team_recruit', '/assets/posters/talent-accelerator-2026.jpg',
 'Mahidol Startup Club × iNT', 'รับ Core Team รุ่นใหม่ ทำงานจริงกับ iNT Mahidol', 'ทำงานจริงกับ iNT Mahidol', 'นักศึกษามหิดลทุกชั้นปี',
 'Talent Accelerator Program 2026 เปิดรับ Core Team รุ่นใหม่ของ Mahidol Startup Club เพื่อทำงานจริงร่วมกับ iNT มหาวิทยาลัยมหิดล',
 null, 'เปิดรับสมัครแล้ว', array['business','marketing','developer','ux_ui'], 'published', true, true, true, false, now()),
('ted-youth-startup-2026', 'Mahidol TED Youth Startup 2026', 'grant', '/assets/posters/ted-youth-startup-2026.jpg',
 'TED Fund × Mahidol', 'ทุนพัฒนาไอเดียและต้นแบบสูงสุด 1.5 ล้านบาท', 'ทุนสูงสุด 1.5 ล้านบาท', 'นศ. + บัณฑิตจบใหม่ ≤ 5 ปี',
 E'Mahidol TED Youth Startup 2026 เป็นโครงการปีที่ 2 ของ TED Fund ร่วมกับมหาวิทยาลัยมหิดล สำหรับนิสิต–นักศึกษาและบัณฑิตจบใหม่ที่อยากเปลี่ยนไอเดียบนฐานเทคโนโลยีและนวัตกรรมให้กลายเป็นธุรกิจจริง\n\nทีมที่ผ่านการคัดเลือกจะได้รับทุนพัฒนาไอเดียและต้นแบบสูงสุด 1.5 ล้านบาท พร้อม Mentoring จากผู้เชี่ยวชาญด้านธุรกิจและเทคโนโลยี และใช้ Co-working Space ได้ตลอดโครงการ\n\nสมัครได้ทั้งแบบมีทีมแล้วหรือยังไม่มีทีม ถ้ายังไม่มีทีม ลองดูทีมที่กำลังมองหาคนด้านล่าง หรือชวนคนเข้าทีมของคุณเองได้เลย',
 '2026-11-30', null, array['developer','ux_ui','business','data_ai','hardware','domain_expert'], 'published', false, true, true, false, now()),
('mahidol-startup-thailand-league-2026', 'Mahidol Startup Thailand League 2026', 'competition', '/assets/posters/startup-thailand-league-2026.jpg',
 'iNT Mahidol', 'การแข่งขันสตาร์ตอัพระดับมหาวิทยาลัย', null, null,
 'Mahidol Startup Thailand League 2026 การแข่งขันสตาร์ตอัพสำหรับนักศึกษามหาวิทยาลัยมหิดล',
 '2026-03-15', null, array['business','developer'], 'published', false, false, true, false, now()),
('blue-horizon-by-int', 'Blue Horizon by iNT', 'incubation', '/assets/posters/blue-horizon.jpg',
 'iNT Mahidol', 'โครงการบ่มเพาะธุรกิจโดย iNT', null, null,
 'Blue Horizon by iNT โครงการบ่มเพาะธุรกิจสำหรับทีมสตาร์ตอัพของมหาวิทยาลัยมหิดล',
 '2026-06-20', null, array['business'], 'published', false, false, true, false, now())
on conflict (slug) do nothing;
