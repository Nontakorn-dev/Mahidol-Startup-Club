import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { facultyLine, initialOf, shortName } from '@/lib/format'
import type { CofounderCard, Profile, PublicAuthor, SeekerCard, TeamCard } from '@/lib/types'
import type { Role, Stage, Track } from '@/lib/constants'

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
    avatar_url: p.avatar_url,
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
