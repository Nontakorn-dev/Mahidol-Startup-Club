// Shared vocabularies. The AI intent parser may only pick values from these lists
// (see Pipeline.html: "ค่าใน JSON ต้องมาจากรายการที่มีอยู่").

export const CATEGORIES = {
  grant: 'ทุนสนับสนุน',
  team_recruit: 'รับสมัครทีม',
  competition: 'การแข่งขัน',
  incubation: 'บ่มเพาะธุรกิจ',
  workshop: 'กิจกรรม / Workshop',
} as const
export type Category = keyof typeof CATEGORIES
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[]

// Team roles — used for "ทักษะที่ทีมมีแล้ว", "ตำแหน่งที่กำลังมองหา" and event tags.
export const ROLES = {
  developer: 'Developer',
  ux_ui: 'UX/UI',
  business: 'Business',
  marketing: 'Marketing',
  data_ai: 'Data / AI',
  hardware: 'Hardware',
  domain_expert: 'Domain expert',
} as const
export type Role = keyof typeof ROLES
export const ROLE_KEYS = Object.keys(ROLES) as Role[]

// Co-founder tracks (coarser than team roles).
export const TRACKS = {
  tech: 'Tech',
  business: 'Business',
  design: 'Design',
  marketing: 'Marketing',
  domain_expert: 'Domain expert',
} as const
export type Track = keyof typeof TRACKS
export const TRACK_KEYS = Object.keys(TRACKS) as Track[]

export const TRACK_SEEK_LABEL: Record<Track, string> = {
  tech: 'Technical co-founder',
  business: 'Business co-founder',
  design: 'Product designer',
  marketing: 'Marketing co-founder',
  domain_expert: 'ผู้เชี่ยวชาญเฉพาะด้าน',
}

export const STAGES = {
  idea: 'Idea',
  prototype: 'Prototype',
  mvp: 'MVP',
  revenue: 'มีรายได้แล้ว',
} as const
export type Stage = keyof typeof STAGES

export const COMMITMENTS = ['Part-time ระหว่างเรียน', 'Full-time หลังเรียนจบ', 'ยังไม่แน่ใจ — อยากคุยก่อน']

export const FACULTIES = [
  'ICT',
  'วิศวกรรมศาสตร์',
  'วิทยาศาสตร์',
  'วิทยาการจัดการ',
  'แพทยศาสตร์ศิริราชพยาบาล',
  'แพทยศาสตร์โรงพยาบาลรามาธิบดี',
  'ทันตแพทยศาสตร์',
  'เภสัชศาสตร์',
  'พยาบาลศาสตร์',
  'สาธารณสุขศาสตร์',
  'เทคนิคการแพทย์',
  'กายภาพบำบัด',
  'สัตวแพทยศาสตร์',
  'สิ่งแวดล้อมและทรัพยากรศาสตร์',
  'ศิลปศาสตร์',
  'สังคมศาสตร์และมนุษยศาสตร์',
  'วิทยาลัยดุริยางคศิลป์',
  'วิทยาลัยนานาชาติ',
  'วิทยาศาสตร์การกีฬา',
  'อื่นๆ',
]

export const YEARS = ['ปี 1', 'ปี 2', 'ปี 3', 'ปี 4', 'ปี 5', 'ปี 6', 'ป.โท', 'ป.เอก', 'บัณฑิตจบใหม่', 'บุคลากร']

export const CAMPUSES = ['ศาลายา', 'พญาไท', 'บางกอกน้อย', 'กาญจนบุรี', 'นครสวรรค์', 'อำนาจเจริญ', 'Online']

export const NOTIFY_TOPICS = [
  {
    key: 'notify_invites',
    title: 'คำชวนเข้าทีม & คำขอทำความรู้จัก',
    desc: 'เมื่อมีคนชวนคุณเข้าทีม หรือขอทำความรู้จัก',
    recommended: true,
  },
  { key: 'notify_matches', title: 'งานแข่งที่ตรงกับคุณ', desc: 'คัดจากสกิลและความสนใจในโปรไฟล์' },
  { key: 'notify_reminders', title: 'เตือนก่อนปิดรับ', desc: 'งานที่คุณบันทึกไว้ ก่อนปิดรับ 3 วัน' },
  { key: 'notify_announcements', title: 'ประกาศจากชมรม', desc: 'กิจกรรม Workshop และข่าวสำคัญ' },
] as const
export type NotifyTopicKey = (typeof NOTIFY_TOPICS)[number]['key']

export const SOCIAL = {
  openChat: 'https://bit.ly/MahidolStartup',
  instagram: 'https://www.instagram.com/mahidolstartup_official',
  instagramHandle: '@mahidolstartup_official',
}

export const HOME_FEATURED_LIMIT = 2
