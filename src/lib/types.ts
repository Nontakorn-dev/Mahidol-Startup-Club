import type { Category, Role, Stage, Track } from './constants'

export type Profile = {
  id: string
  email: string | null
  email_is_placeholder: boolean
  first_name: string
  last_name: string
  avatar_url: string | null
  faculty: string | null
  year: string | null
  campus: string | null
  headline: string | null
  bio: string | null
  skills: string[]
  interests: string[]
  links: { label: string; url: string }[]
  experiences: { title: string; subtitle?: string; description?: string }[]
  availability: string | null
  work_mode: string | null
  start_when: string | null
  role: 'user' | 'admin'
  is_suspended: boolean
  is_verified: boolean
  line_user_id: string | null
  line_display_name: string | null
  line_picture_url: string | null
  line_is_friend: boolean
  line_linked_at: string | null
  notify_invites: boolean
  notify_matches: boolean
  notify_reminders: boolean
  notify_announcements: boolean
  notify_frequency: 'instant' | 'daily'
  email_notifications: boolean
  onboarded: boolean
  admin_last_seen_at: string | null
  created_at: string
}

export type EventRow = {
  id: string
  slug: string
  title: string
  category: Category
  poster_url: string | null
  organizer: string | null
  summary: string | null
  benefit: string | null
  eligibility: string | null
  overview: string | null
  apply_url: string | null
  deadline: string | null
  deadline_at: string | null
  event_start: string | null
  event_end: string | null
  location: string | null
  format: 'onsite' | 'online' | 'hybrid' | null
  open_note: string | null
  tags: string[]
  status: 'draft' | 'published'
  is_club: boolean
  allow_teams: boolean
  featured: boolean
  notify_on_publish: boolean
  notified_at: string | null
  published_at: string | null
  updated_at: string
  updated_by: string | null
  source: string | null
  source_url: string | null
}

/** Public, sanitised author info. `id` is only present when the author is not anonymous. */
export type PublicAuthor = {
  id: string | null
  name: string
  faculty_line: string
  avatar_url: string | null
  initial: string
  anonymous: boolean
  verified: boolean
}

export type TeamCard = {
  id: string
  name: string
  pitch: string
  details: string | null
  event: { id: string; slug: string; title: string } | null
  event_note: string | null
  members_count: number
  target_size: number
  has_skills: Role[]
  roles_needed: Role[]
  member_initials: string[]
  author: PublicAuthor
  is_mine: boolean
  status: string
  created_at: string
}

export type SeekerCard = {
  id: string
  looking_text: string
  skills: string[]
  details: string | null
  event: { id: string; slug: string; title: string } | null
  author: PublicAuthor
  is_mine: boolean
  status: string
  created_at: string
}

export type CofounderCard = {
  id: string
  my_skills: Track[]
  about: string | null
  seeking: Track[]
  portfolio_url: string | null
  idea_title: string | null
  problem: string | null
  stage: Stage
  commitment: string | null
  my_domain: string | null
  seeking_domain: string | null
  skill_tags: string[]
  author: PublicAuthor
  is_mine: boolean
  status: string
  created_at: string
}
