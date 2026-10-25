import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { eventBlurb, facultyLine, hiResAvatar, initialOf, shortName, thaiDeadline } from '@/lib/format'
import { CATEGORIES, ROLES, ROLE_KEYS, type Role, type Stage, type Track, getDomainExpertField } from '@/lib/constants'
import type { BuddyCard, BuddyWorkItem, CofounderCard, EventRow, Profile, PublicAuthor, RecommendedEvent, SeekerCard, TeamCard } from '@/lib/types'

type AuthorRow = Pick<Profile, 'id' | 'first_name' | 'last_name' | 'faculty' | 'year' | 'avatar_url' | 'is_verified' | 'skills'>
const AUTHOR_COLS = 'id, first_name, last_name, faculty, year, avatar_url, is_verified, skills'

/** Strip identity when anonymous: only faculty/year stay visible (as in the design). */
export function toPublicAuthor(p: AuthorRow | null | undefined, anonymous: boolean): PublicAuthor {
  if (!p) {
    return { id: null, name: 'สมาชิก', faculty_line: '', avatar_url: null, initial: '?', anonymous: true, verified: false }
  }
  if (anonymous) {
    return {
      id: null,
      name: 'ไม่ระบุชื่อ',
      faculty_line: facultyLine(p.faculty, p.year),
      avatar_url: null,
      initial: '',
      anonymous: true,
      verified: false,
    }
  }
  const name = shortName(p.first_name, p.last_name)
  return {
    id: p.id,
    name,
    faculty_line: facultyLine(p.faculty, p.year),
    avatar_url: hiResAvatar(p.avatar_url),
    initial: initialOf(p.first_name || name),
    anonymous: false,
    verified: p.is_verified,
  }
}

async function authorsById(ids: string[]) {
  const unique = [...new Set(ids)].filter(Boolean)
  if (!unique.length) return new Map<string, AuthorRow>()
  const { data } = await adminClient().from('profiles').select(AUTHOR_COLS).in('id', unique)
  return new Map((data || []).map((p) => [p.id as string, p as AuthorRow]))
}

const EVENT_JOIN = 'event:events(id, slug, title)'

type TeamFilter = { eventId?: string; roles?: string[]; ownerId?: string; ids?: string[]; limit?: number; includeClosed?: boolean }

export async function listTeams(viewerId: string | null, f: TeamFilter = {}): Promise<TeamCard[]> {
  let q = adminClient()
    .from('team_posts')
    .select(`*, ${EVENT_JOIN}`)
    .order('created_at', { ascending: false })
    .limit(f.limit ?? 60)
  q = f.includeClosed ? q.neq('status', 'removed') : q.eq('status', 'open')
  if (f.eventId) q = q.eq('event_id', f.eventId)
  if (f.roles?.length) q = q.overlaps('roles_needed', f.roles)
  if (f.ownerId) q = q.eq('owner_id', f.ownerId)
  if (f.ids) q = q.in('id', f.ids.length ? f.ids : ['00000000-0000-0000-0000-000000000000'])
  const { data } = await q
  const rows = data || []
  const teamIds = rows.map((r) => r.id)
  const { data: members } = teamIds.length
    ? await adminClient().from('team_members').select('team_id, user_id').in('team_id', teamIds)
    : { data: [] as { team_id: string; user_id: string }[] }
  const authors = await authorsById([...rows.map((r) => r.owner_id), ...(members || []).map((m) => m.user_id)])

  return rows.map((r) => {
    const owner = authors.get(r.owner_id)
    const memberRows = (members || []).filter((m) => m.team_id === r.id && m.user_id !== r.owner_id)
    const initials = [
      r.is_anonymous ? '' : initialOf(owner?.first_name),
      ...memberRows.map((m) => initialOf(authors.get(m.user_id)?.first_name)),
    ].filter(Boolean)
    return {
      id: r.id,
      name: r.name,
      pitch: r.pitch,
      details: r.details,
      event: r.event ?? null,
      event_note: r.event_note,
      members_count: r.members_count,
      target_size: r.target_size,
      has_skills: r.has_skills as Role[],
      roles_needed: r.roles_needed as Role[],
      member_initials: initials.slice(0, 4),
      author: toPublicAuthor(owner, r.is_anonymous),
      is_mine: viewerId === r.owner_id,
      status: r.status,
      created_at: r.created_at,
    }
  })
}

type SeekerFilter = { eventId?: string; skills?: string[]; ownerId?: string; ids?: string[]; limit?: number; includeClosed?: boolean }

export async function listSeekers(viewerId: string | null, f: SeekerFilter = {}): Promise<SeekerCard[]> {
  let q = adminClient()
    .from('seeker_posts')
    .select(`*, ${EVENT_JOIN}`)
    .order('created_at', { ascending: false })
    .limit(f.limit ?? 60)
  q = f.includeClosed ? q.neq('status', 'removed') : q.eq('status', 'open')
  if (f.eventId) q = q.eq('event_id', f.eventId)
  if (f.ownerId) q = q.eq('owner_id', f.ownerId)
  if (f.ids) q = q.in('id', f.ids.length ? f.ids : ['00000000-0000-0000-0000-000000000000'])
  const { data } = await q
  let rows = data || []
  const authors = await authorsById(rows.map((r) => r.owner_id))
  if (f.skills?.length) {
    // Match on post skills or the owner's profile skills (case-insensitive substring).
    const wanted = f.skills.map((s) => s.toLowerCase())
    rows = rows.filter((r) => {
      const hay = [...(r.skills || []), ...(authors.get(r.owner_id)?.skills || [])].map((s: string) => s.toLowerCase())
      return wanted.some((w) => hay.some((h) => h.includes(w) || w.includes(h)))
    })
  }
  return rows.map((r) => ({
    id: r.id,
    looking_text: r.looking_text,
    skills: r.skills?.length ? r.skills : (authors.get(r.owner_id)?.skills || []).slice(0, 3),
    details: r.details,
    event: r.event ?? null,
    author: toPublicAuthor(authors.get(r.owner_id), r.is_anonymous),
    is_mine: viewerId === r.owner_id,
    status: r.status,
    created_at: r.created_at,
  }))
}

type CofounderFilter = { seeking?: string[]; ownerId?: string; ids?: string[]; limit?: number; includeClosed?: boolean }

export async function listCofounders(viewerId: string | null, f: CofounderFilter = {}): Promise<CofounderCard[]> {
  let q = adminClient()
    .from('cofounder_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(f.limit ?? 60)
  q = f.includeClosed ? q.neq('status', 'removed') : q.eq('status', 'open')
  if (f.seeking?.length) q = q.overlaps('seeking', f.seeking)
  if (f.ownerId) q = q.eq('owner_id', f.ownerId)
  if (f.ids) q = q.in('id', f.ids.length ? f.ids : ['00000000-0000-0000-0000-000000000000'])
  const { data } = await q
  const rows = data || []
  const authors = await authorsById(rows.map((r) => r.owner_id))
  return rows.map((r) => {
    const owner = authors.get(r.owner_id)
    return {
      id: r.id,
      my_skills: r.my_skills as Track[],
      about: r.about,
      seeking: r.seeking as Track[],
      portfolio_url: r.is_anonymous ? null : r.portfolio_url,
      idea_title: r.idea_title,
      problem: r.problem,
      stage: r.stage as Stage,
      commitment: r.commitment,
      my_domain: r.my_domain ?? null,
      seeking_domain: r.seeking_domain ?? null,
      skill_tags: (owner?.skills || []).slice(0, 3),
      author: toPublicAuthor(owner, r.is_anonymous),
      is_mine: viewerId === r.owner_id,
      status: r.status,
      created_at: r.created_at,
    }
  })
}

// ------------------------------------------------------------------ one post (its own page)

export type PostType = 'team' | 'seeker' | 'cofounder'
const POST_TABLE = { team: 'team_posts', seeker: 'seeker_posts', cofounder: 'cofounder_posts' } as const
/** Long description + contact line: only loaded for the post page, never for lists/cards. */
export type PostExtra = { details: string | null; contact: string | null; updated_at: string }

async function postExtra(type: PostType, id: string): Promise<PostExtra | null> {
  const { data } = await adminClient().from(POST_TABLE[type]).select('details, contact, updated_at').eq('id', id).maybeSingle()
  return data as PostExtra | null
}

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

/** Open post (or the viewer's own, any status but removed) with its full details. */
export async function getTeamPost(id: string, viewerId: string | null) {
  if (!isUuid(id)) return null
  const [card] = await listTeams(viewerId, { ids: [id], includeClosed: true })
  if (!card || (card.status !== 'open' && !card.is_mine)) return null
  return { card, extra: await postExtra('team', id) }
}
export async function getSeekerPost(id: string, viewerId: string | null) {
  if (!isUuid(id)) return null
  const [card] = await listSeekers(viewerId, { ids: [id], includeClosed: true })
  if (!card || (card.status !== 'open' && !card.is_mine)) return null
  return { card, extra: await postExtra('seeker', id) }
}
export async function getCofounderPost(id: string, viewerId: string | null) {
  if (!isUuid(id)) return null
  const [card] = await listCofounders(viewerId, { ids: [id], includeClosed: true })
  if (!card || (card.status !== 'open' && !card.is_mine)) return null
  return { card, extra: await postExtra('cofounder', id) }
}

/** Resolve the owner of any target a request can point at. Server-only — never expose. */
export async function resolveTargetOwner(
  type: 'profile' | 'seeker' | 'team' | 'cofounder',
  id: string,
): Promise<{ ownerId: string; anonymous: boolean; teamId: string | null } | null> {
  const db = adminClient()
  if (type === 'profile') {
    const { data } = await db.from('profiles').select('id').eq('id', id).maybeSingle()
    return data ? { ownerId: data.id, anonymous: false, teamId: null } : null
  }
  const table = type === 'seeker' ? 'seeker_posts' : type === 'team' ? 'team_posts' : 'cofounder_posts'
  const { data } = await db.from(table).select('owner_id, is_anonymous, status').eq('id', id).maybeSingle()
  if (!data || data.status === 'removed') return null
  return { ownerId: data.owner_id, anonymous: data.is_anonymous, teamId: type === 'team' ? id : null }
}

// ------------------------------------------------------------------ "หาเพื่อนร่วมทางที่ใช่" (member directory showcase)

const ROLE_PATTERNS: [Role, RegExp][] = [
  ['developer', /dev|full[- ]?stack|front[- ]?end|back[- ]?end|react|next|node|typescript|javascript|flutter|mobile|web|software|โปรแกรม/i],
  ['ux_ui', /ux|ui|figma|design|prototype|กราฟิก|ดีไซน์|ออกแบบ/i],
  ['business', /business|pitch|finance|strategy|management|bba|ธุรกิจ|บริหาร/i],
  ['marketing', /market|content|branding|social|growth|การตลาด/i],
  ['data_ai', /data|ai|ml|machine learning|deep learning|python|analytics|สถิติ/i],
  ['hardware', /hardware|iot|embedded|robot|arduino|ฮาร์ดแวร์/i],
  ['domain_expert', /med|health|pharma|clinic|bio|doctor|nurse|แพทย์|เภสัช|พยาบาล|ทันต|สาธารณสุข|วิทย์/i],
]

export function inferRoles(p: Pick<Profile, 'interests' | 'skills' | 'headline' | 'faculty'>): Role[] {
  const out = new Set<Role>()
  for (const r of p.interests || []) {
    if ((ROLE_KEYS as string[]).includes(r)) out.add(r as Role)
  }
  for (const s of p.skills || []) {
    if ((ROLE_KEYS as string[]).includes(s)) out.add(s as Role)
  }
  const text = [p.headline, ...(p.skills || []), p.faculty].filter(Boolean).join(' ')
  for (const [role, rx] of ROLE_PATTERNS) {
    if (rx.test(text)) out.add(role)
  }
  return [...out]
}

export function recommendEventsForRoles(roles: Role[], skills: string[], openEvents: EventRow[], limit = 3): RecommendedEvent[] {
  const skillLower = skills.map((s) => s.toLowerCase())
  const scored = openEvents.map((e) => {
    let score = 0
    const matchedRoles = (e.tags || []).filter((t) => roles.includes(t as Role)) as Role[]
    if (matchedRoles.length) score += matchedRoles.length * 4
    const text = `${e.title} ${e.summary ?? ''} ${e.overview ?? ''}`.toLowerCase()
    if (skillLower.some((s) => s.length >= 3 && text.includes(s))) score += 2
    if (e.is_club) score += 1.5
    if (e.featured) score += 1
    const matchReason = matchedRoles.length
      ? `เหมาะกับสาย ${matchedRoles.slice(0, 2).map((r) => ROLES[r]).join(', ')}`
      : e.is_club
        ? 'กิจกรรมจากชมรม'
        : CATEGORIES[e.category]
    return {
      score,
      item: {
        id: e.id,
        slug: e.slug,
        title: e.title,
        poster_url: e.poster_url,
        summary: eventBlurb(e),
        organizer: e.organizer,
        is_club: e.is_club,
        categoryLabel: CATEGORIES[e.category],
        deadlineLabel: e.deadline ? `ปิดรับ ${thaiDeadline(e)}` : e.open_note || 'เปิดรับสมัครอยู่',
        benefit: e.benefit,
        matchReason,
      } satisfies RecommendedEvent,
    }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => s.item)
}

const AWARD_RX = /(finalist|winner|award|runner|รางวัล|ชนะ|เข้ารอบ|ทุน|league|hack|competition|ประกวด|แข่งขัน|1st|2nd|3rd|top)/i

const BUDDY_COLS =
  'id, first_name, last_name, faculty, year, campus, avatar_url, line_picture_url, headline, bio, skills, interests, experiences, availability, work_mode, is_verified, created_at'

export async function listHomePeople(
  viewerId: string | null,
  opts: {
    teams?: TeamCard[]
    seekers?: SeekerCard[]
    cofounders?: CofounderCard[]
    openEvents?: EventRow[]
    limit?: number
  } = {},
): Promise<BuddyCard[]> {
  const { data } = await adminClient()
    .from('profiles')
    .select(BUDDY_COLS)
    .eq('profile_public', true)
    .eq('onboarded', true)
    .eq('is_suspended', false)
    .neq('first_name', '')
    .order('is_verified', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 60)

  const rows = (data || []) as Pick<
    Profile,
    | 'id'
    | 'first_name'
    | 'last_name'
    | 'faculty'
    | 'year'
    | 'campus'
    | 'avatar_url'
    | 'line_picture_url'
    | 'headline'
    | 'bio'
    | 'skills'
    | 'interests'
    | 'experiences'
    | 'availability'
    | 'work_mode'
    | 'is_verified'
    | 'created_at'
  >[]

  const teams = opts.teams ?? []
  const seekers = opts.seekers ?? []
  const cofounders = opts.cofounders ?? []
  const openEvents = opts.openEvents ?? []

  // Sort richest profiles first so cards on the home page showcase complete community members.
  const richness = (p: (typeof rows)[number]) =>
    (p.is_verified ? 4 : 0) +
    (p.avatar_url || p.line_picture_url ? 4 : 0) +
    ((p.experiences || []).length > 0 ? 4 : 0) +
    (p.bio ? 3 : 0) +
    (p.headline ? 2 : 0) +
    ((p.skills || []).length > 0 ? 2 : 0)

  const sorted = [...rows].sort((a, b) => richness(b) - richness(a))

  // Viewer's own open teams come first when matching "ที่ทีม ... กำลังมองหา"
  const orderedTeams = [...teams].sort((a, b) => Number(b.is_mine) - Number(a.is_mine))

  return sorted.map((p) => {
    const name = shortName(p.first_name, p.last_name)
    const roles = inferRoles(p)
    const domainField = getDomainExpertField(p.interests)
    const baseSkills = (p.skills || []).map((k) => ROLES[k as Role] ?? k)
    const skills = domainField ? [`Domain expert (${domainField})`, ...baseSkills] : baseSkills

    // Primary role label for the subtitle under the name ("Full-stack Developer · ICT · ปี 3")
    const headlineRole = p.headline ? p.headline.split(/[·|•—]/)[0].trim() : ''
    const primaryRole =
      headlineRole ||
      skills[0] ||
      (roles[0] ? ROLES[roles[0]] : '') ||
      'สมาชิกชมรม'
    const role_line = [primaryRole, p.faculty, p.year].filter(Boolean).join(' · ')

    // Match line ("ถนัด Full-stack ที่ทีม Queue0 กำลังมองหา")
    const matchingTeam = orderedTeams.find(
      (t) => t.author.id !== p.id && t.roles_needed.some((r) => roles.includes(r)),
    )
    const seekerPost = seekers.find((s) => s.author.id === p.id)
    const cofounderPost = cofounders.find((c) => c.author.id === p.id)
    const myTeamPost = teams.find((t) => t.author.id === p.id)

    let match_line = ''
    if (matchingTeam) {
      const matchedRole = matchingTeam.roles_needed.find((r) => roles.includes(r))!
      const roleRx = ROLE_PATTERNS.find(([r]) => r === matchedRole)?.[1]
      const matchingSkill = skills.find((s) => roleRx?.test(s)) || skills[0] || ROLES[matchedRole]
      match_line = `ถนัด ${matchingSkill} ที่ทีม ${matchingTeam.name} กำลังมองหา`
    } else if (seekerPost) {
      match_line = `กำลังมองหาทีม · ${seekerPost.event?.title ?? seekerPost.looking_text}`
    } else if (cofounderPost) {
      match_line = `กำลังหา Co-Founder · ${cofounderPost.idea_title || 'สร้างโปรเจกต์สตาร์ตอัพ'}`
    } else if (skills.length > 0) {
      match_line = `ถนัด ${skills.slice(0, 2).join(' · ')} พร้อมลุยโปรเจกต์จริง`
    } else if (p.headline) {
      match_line = p.headline
    } else {
      match_line = 'พร้อมทำความรู้จักและแลกเปลี่ยนไอเดียกับเพื่อนร่วมทีม'
    }

    const bio =
      p.bio ||
      seekerPost?.details ||
      seekerPost?.looking_text ||
      cofounderPost?.about ||
      cofounderPost?.problem ||
      p.headline ||
      `สมาชิกเครือข่าย Mahidol Startup Club${p.faculty ? ` คณะ${p.faculty}` : ''}`

    const works: BuddyWorkItem[] = (p.experiences || [])
      .filter((x) => x && x.title)
      .slice(0, 2)
      .map((x, idx) => ({
        kind: AWARD_RX.test(x.title) || (idx === 0 && /ทีม|project|league|hack/i.test(x.subtitle || '')) ? 'award' : 'project',
        title: x.title,
        subtitle: [x.subtitle, x.description].filter(Boolean).join(' · '),
      }))

    if (works.length === 0) {
      if (myTeamPost) {
        works.push({
          kind: 'award',
          title: `ทีม ${myTeamPost.name}${myTeamPost.event ? ` · ${myTeamPost.event.title}` : ''}`,
          subtitle: myTeamPost.pitch,
        })
      }
      if (cofounderPost && works.length < 2) {
        works.push({
          kind: 'project',
          title: cofounderPost.idea_title || 'กำลังพัฒนาไอเดียสตาร์ตอัพ',
          subtitle: cofounderPost.problem || cofounderPost.about || 'เปิดรับ Co-Founder',
        })
      }
    }

    return {
      id: p.id,
      name,
      verified: Boolean(p.is_verified),
      role_line,
      avatar_url: hiResAvatar(p.avatar_url || p.line_picture_url),
      initial: initialOf(p.first_name || name),
      roles,
      match_line,
      bio,
      works,
      skills,
      is_mine: viewerId === p.id,
      recommended_events: recommendEventsForRoles(roles, skills, openEvents, 3),
    }
  })
}
