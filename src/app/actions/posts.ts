'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { errMsg, splitTags } from '@/lib/form-errors'
import { actionViewer } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { ROLE_KEYS, TRACK_KEYS } from '@/lib/constants'

type State = { error?: string } | null

const roleList = z.array(z.enum(ROLE_KEYS as [string, ...string[]])).max(7)
const trackList = z.array(z.enum(TRACK_KEYS as [string, ...string[]])).max(5)
const optUuid = z.union([z.uuid(), z.literal('')]).optional().transform((v) => v || null)
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)


// ------------------------------------------------------------------ team calls

const TeamSchema = z.object({
  id: optUuid,
  name: z.string().trim().min(1, 'กรุณาระบุชื่อทีมหรือชื่อโปรเจกต์').max(60),
  event: z.string().optional(),
  pitch: z.string().trim().min(1, 'กรุณาสรุปโปรเจกต์ในหนึ่งประโยค').max(120),
  details: optText(4000),
  contact: optText(200),
  members_count: z.coerce.number().int().min(1).max(20),
  target_size: z.coerce.number().int().min(2).max(30),
  has_skills: roleList,
  roles_needed: roleList.min(1, 'กรุณาเลือกตำแหน่งที่ต้องการอย่างน้อย 1 ตำแหน่ง'),
})

export async function saveTeam(_prev: State, form: FormData): Promise<State> {
  let dest: string
  try {
    const viewer = await actionViewer()
    const draft = form.get('intent') === 'draft'
    const v = TeamSchema.parse({
      id: form.get('id') ?? '',
      name: form.get('name'),
      event: form.get('event') ?? '',
      pitch: form.get('pitch'),
      details: form.get('details') ?? '',
      contact: form.get('contact') ?? '',
      members_count: form.get('members_count'),
      target_size: form.get('target_size'),
      has_skills: form.getAll('has_skills'),
      roles_needed: form.getAll('roles_needed'),
    })
    if (v.target_size <= v.members_count) throw new Error('จำนวนสมาชิกที่ต้องการต้องมากกว่าจำนวนสมาชิกปัจจุบัน')
    const eventId = v.event && z.uuid().safeParse(v.event).success ? v.event : null
    const row = {
      name: v.name,
      event_id: eventId,
      event_note: !eventId && v.event === 'other' ? String(form.get('event_text') || '').trim().slice(0, 80) || 'รายการอื่น' : null,
      pitch: v.pitch,
      details: v.details,
      contact: v.contact,
      members_count: v.members_count,
      target_size: v.target_size,
      has_skills: v.has_skills,
      roles_needed: v.roles_needed,
      is_anonymous: form.get('anonymous') === 'on',
      status: draft ? 'draft' : 'open',
    }
    const db = adminClient()
    if (v.id) {
      const { data: existing } = await db.from('team_posts').select('owner_id').eq('id', v.id).maybeSingle()
      if (!existing || existing.owner_id !== viewer.userId) throw new Error('แก้ไขได้เฉพาะประกาศของคุณ')
      await db.from('team_posts').update(row).eq('id', v.id)
      dest = `/teams/${v.id}`
    } else {
      const { data, error } = await db.from('team_posts').insert({ ...row, owner_id: viewer.userId }).select('id').single()
      if (error || !data) throw new Error('บันทึกไม่สำเร็จ')
      await db.from('team_members').insert({ team_id: data.id, user_id: viewer.userId })
      dest = `/teams/${data.id}`
    }
    if (draft) dest = '/me?saved=draft'
    revalidatePath('/teams')
  } catch (err) {
    return { error: errMsg(err) }
  }
  redirect(dest)
}

// ------------------------------------------------------------------ "looking for a team"

const SeekerSchema = z.object({
  id: optUuid,
  event: z.string().optional(),
  event_text: z.string().trim().max(80).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(6),
  details: optText(4000),
  contact: optText(200),
})

export async function saveSeeker(_prev: State, form: FormData): Promise<State> {
  let sid: string | null = null
  try {
    const viewer = await actionViewer()
    const v = SeekerSchema.parse({
      id: form.get('id') ?? '',
      event: form.get('event') ?? '',
      event_text: String(form.get('event_text') ?? ''),
      skills: splitTags(form.get('skills'), 6),
      details: form.get('details') ?? '',
      contact: form.get('contact') ?? '',
    })
    const eventId = v.event && z.uuid().safeParse(v.event).success ? v.event : null
    if (v.event === 'other' && !v.event_text) throw new Error('กรุณาระบุชื่อรายการแข่งขัน')
    // Card line "ต้องการเข้าร่วม …": the chosen event, the typed name, or any event.
    const looking_text = eventId
      ? ((await adminClient().from('events').select('title').eq('id', eventId).maybeSingle()).data?.title ?? 'เปิดรับทุกรายการ').slice(0, 80)
      : v.event === 'other'
        ? v.event_text!
        : 'เปิดรับทุกรายการ'
    const row = {
      looking_text,
      event_id: eventId,
      skills: v.skills,
      details: v.details,
      contact: v.contact,
      is_anonymous: form.get('anonymous') === 'on',
      status: 'open',
    }
    const db = adminClient()
    if (v.id) {
      const { data: existing } = await db.from('seeker_posts').select('owner_id').eq('id', v.id).maybeSingle()
      if (!existing || existing.owner_id !== viewer.userId) throw new Error('แก้ไขได้เฉพาะประกาศของคุณ')
      await db.from('seeker_posts').update(row).eq('id', v.id)
    } else {
      const { data } = await db.from('seeker_posts').insert({ ...row, owner_id: viewer.userId }).select('id').single()
      v.id = data?.id ?? null
    }
    revalidatePath('/teams')
    sid = v.id ?? null
  } catch (err) {
    return { error: errMsg(err) }
  }
  redirect(sid ? `/teams/looking/${sid}` : '/teams?tab=team')
}

// ------------------------------------------------------------------ co-founder profile (one per user)

const CofounderSchema = z.object({
  my_skills: trackList.min(1, 'กรุณาเลือกความเชี่ยวชาญของคุณอย่างน้อย 1 ด้าน'),
  about: optText(160),
  seeking: trackList.min(1, 'กรุณาเลือกด้านของ Co-Founder ที่ต้องการอย่างน้อย 1 ด้าน'),
  portfolio_url: z.union([z.url('ลิงก์ผลงานไม่ถูกต้อง'), z.literal('')]).optional().transform((v) => v || null),
  idea_title: z.string().trim().min(1, 'กรุณาระบุชื่อโปรเจกต์หรือสตาร์ตอัพ').max(80),
  problem: z.string().trim().min(1, 'กรุณาอธิบายปัญหาที่ต้องการแก้ไข').max(1500),
  details: optText(4000),
  contact: optText(200),
  my_domain: optText(60),
  seeking_domain: optText(60),
  stage: z.enum(['idea', 'prototype', 'mvp', 'revenue']),
  commitment: optText(60),
})

export async function saveCofounder(_prev: State, form: FormData): Promise<State> {
  let cid: string | null = null
  try {
    const viewer = await actionViewer()
    const draft = form.get('intent') === 'draft'
    const v = CofounderSchema.parse({
      my_skills: form.getAll('my_skills'),
      about: form.get('about') ?? '',
      seeking: form.getAll('seeking'),
      portfolio_url: form.get('portfolio_url') ?? '',
      idea_title: form.get('idea_title'),
      problem: form.get('problem'),
      stage: form.get('stage') || 'idea',
      commitment: form.get('commitment') ?? '',
      details: form.get('details') ?? '',
      contact: form.get('contact') ?? '',
      my_domain: form.get('my_domain') ?? '',
      seeking_domain: form.get('seeking_domain') ?? '',
    })
    if (v.my_skills.includes('domain_expert') && !v.my_domain) throw new Error('กรุณาระบุด้านที่คุณเชี่ยวชาญ')
    if (v.seeking.includes('domain_expert') && !v.seeking_domain) throw new Error('กรุณาระบุด้านของผู้เชี่ยวชาญที่ต้องการ')
    if (!v.my_skills.includes('domain_expert')) v.my_domain = null
    if (!v.seeking.includes('domain_expert')) v.seeking_domain = null
    const row = { ...v, is_anonymous: form.get('anonymous') === 'on', status: draft ? 'draft' : 'open' }
    const db = adminClient()
    const { data: existing } = await db
      .from('cofounder_posts')
      .select('id')
      .eq('owner_id', viewer.userId)
      .neq('status', 'removed')
      .maybeSingle()
    if (existing) await db.from('cofounder_posts').update(row).eq('id', existing.id)
    else cid = (await db.from('cofounder_posts').insert({ ...row, owner_id: viewer.userId }).select('id').single()).data?.id ?? null
    if (existing) cid = existing.id
    revalidatePath('/teams')
  } catch (err) {
    return { error: errMsg(err) }
  }
  redirect(form.get('intent') === 'draft' ? '/me?saved=draft' : cid ? `/cofounder/${cid}` : '/teams?tab=cofounder')
}

// ------------------------------------------------------------------ status changes from "ประกาศของฉัน"

const TABLES = { team: 'team_posts', seeker: 'seeker_posts', cofounder: 'cofounder_posts' } as const

export async function setPostStatus(form: FormData) {
  const viewer = await actionViewer()
  const type = z.enum(['team', 'seeker', 'cofounder']).parse(form.get('type'))
  const id = z.uuid().parse(form.get('id'))
  const status = z.enum(['open', 'closed', 'delete']).parse(form.get('status'))
  const db = adminClient()
  const { data } = await db.from(TABLES[type]).select('owner_id').eq('id', id).maybeSingle()
  if (!data || data.owner_id !== viewer.userId) throw new Error('ไม่มีสิทธิ์')
  if (status === 'delete') await db.from(TABLES[type]).delete().eq('id', id)
  else await db.from(TABLES[type]).update({ status }).eq('id', id)
  revalidatePath('/me')
  revalidatePath('/teams')
  revalidatePath('/')
  // From an edit page: leave it (the post may be gone).
  const next = String(form.get('next') || '')
  if (next.startsWith('/') && !next.startsWith('//')) redirect(next)
}
