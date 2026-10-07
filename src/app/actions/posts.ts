'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionViewer } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { ROLE_KEYS, TRACK_KEYS } from '@/lib/constants'

type State = { error?: string } | null

const roleList = z.array(z.enum(ROLE_KEYS as [string, ...string[]])).max(7)
const trackList = z.array(z.enum(TRACK_KEYS as [string, ...string[]])).max(5)
const optUuid = z.union([z.uuid(), z.literal('')]).optional().transform((v) => v || null)
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)

const errMsg = (err: unknown) => (err instanceof z.ZodError ? err.issues[0].message : (err as Error).message)

// ------------------------------------------------------------------ team calls

const TeamSchema = z.object({
  id: optUuid,
  name: z.string().trim().min(1, 'กรุณาใส่ชื่อทีม / โปรเจกต์').max(60),
  event: z.string().optional(),
  pitch: z.string().trim().min(1, 'กรุณาเล่าไอเดียในหนึ่งประโยค').max(120),
  details: optText(2000),
  members_count: z.coerce.number().int().min(1).max(20),
  target_size: z.coerce.number().int().min(2).max(30),
  has_skills: roleList,
  roles_needed: roleList.min(1, 'เลือกตำแหน่งที่กำลังมองหาอย่างน้อย 1 อย่าง'),
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
      members_count: form.get('members_count'),
      target_size: form.get('target_size'),
      has_skills: form.getAll('has_skills'),
      roles_needed: form.getAll('roles_needed'),
    })
    if (v.target_size <= v.members_count) throw new Error('จำนวนคนที่อยากให้มีต้องมากกว่าจำนวนสมาชิกตอนนี้')
    const eventId = v.event && z.uuid().safeParse(v.event).success ? v.event : null
    const row = {
      name: v.name,
      event_id: eventId,
      event_note: !eventId && v.event === 'other' ? 'งานแข่งอื่นๆ / ยังไม่แน่ใจ' : null,
      pitch: v.pitch,
      details: v.details,
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
      dest = `/teams?tab=teams&posted=${v.id}`
    } else {
      const { data, error } = await db.from('team_posts').insert({ ...row, owner_id: viewer.userId }).select('id').single()
      if (error || !data) throw new Error('บันทึกไม่สำเร็จ')
      await db.from('team_members').insert({ team_id: data.id, user_id: viewer.userId })
      dest = `/teams?tab=teams&posted=${data.id}`
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
  looking_text: z.string().trim().min(1, 'บอกหน่อยว่ากำลังมองหาทีมแบบไหน').max(80),
  event: z.string().optional(),
  skills: z.array(z.string().trim().min(1).max(30)).max(6),
  details: optText(1000),
})

export async function saveSeeker(_prev: State, form: FormData): Promise<State> {
  try {
    const viewer = await actionViewer()
    const v = SeekerSchema.parse({
      id: form.get('id') ?? '',
      looking_text: form.get('looking_text'),
      event: form.get('event') ?? '',
      skills: String(form.get('skills') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      details: form.get('details') ?? '',
    })
    const row = {
      looking_text: v.looking_text,
      event_id: v.event && z.uuid().safeParse(v.event).success ? v.event : null,
      skills: v.skills,
      details: v.details,
      is_anonymous: form.get('anonymous') === 'on',
      status: 'open',
    }
    const db = adminClient()
    if (v.id) {
      const { data: existing } = await db.from('seeker_posts').select('owner_id').eq('id', v.id).maybeSingle()
      if (!existing || existing.owner_id !== viewer.userId) throw new Error('แก้ไขได้เฉพาะประกาศของคุณ')
      await db.from('seeker_posts').update(row).eq('id', v.id)
    } else {
      await db.from('seeker_posts').insert({ ...row, owner_id: viewer.userId })
    }
    revalidatePath('/teams')
  } catch (err) {
    return { error: errMsg(err) }
  }
  redirect('/teams?tab=people')
}

// ------------------------------------------------------------------ co-founder profile (one per user)

const CofounderSchema = z.object({
  my_skills: trackList.min(1, 'เลือกทักษะหลักของคุณอย่างน้อย 1 อย่าง'),
  about: optText(160),
  seeking: trackList.min(1, 'เลือกสายของ co-founder ที่มองหาอย่างน้อย 1 อย่าง'),
  portfolio_url: z.union([z.url('ลิงก์ผลงานไม่ถูกต้อง'), z.literal('')]).optional().transform((v) => v || null),
  idea_title: z.string().trim().min(1, 'กรุณาใส่ชื่อไอเดีย').max(80),
  problem: z.string().trim().min(1, 'เล่าปัญหาที่อยากแก้สั้นๆ').max(1500),
  stage: z.enum(['idea', 'prototype', 'mvp', 'revenue']),
  commitment: optText(60),
})

export async function saveCofounder(_prev: State, form: FormData): Promise<State> {
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
    })
    const row = { ...v, is_anonymous: form.get('anonymous') === 'on', status: draft ? 'draft' : 'open' }
    const db = adminClient()
    const { data: existing } = await db
      .from('cofounder_posts')
      .select('id')
      .eq('owner_id', viewer.userId)
      .neq('status', 'removed')
      .maybeSingle()
    if (existing) await db.from('cofounder_posts').update(row).eq('id', existing.id)
    else await db.from('cofounder_posts').insert({ ...row, owner_id: viewer.userId })
    revalidatePath('/cofounder')
  } catch (err) {
    return { error: errMsg(err) }
  }
  redirect(form.get('intent') === 'draft' ? '/me?saved=draft' : '/cofounder')
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
  revalidatePath('/cofounder')
}
