'use server'
import { redirect } from 'next/navigation'
import { revalidatePath, updateTag } from 'next/cache'
import { after } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { actionAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { notifyEventMatches } from '@/lib/event-notify'
import { notifyUsers } from '@/lib/notify'
import { isClosed, slugify } from '@/lib/format'
import { CATEGORY_KEYS, HOME_FEATURED_LIMIT, ROLE_KEYS } from '@/lib/constants'
import type { EventRow } from '@/lib/types'

type State = { error?: string; ok?: string } | null
const errMsg = (err: unknown) => (err instanceof z.ZodError ? err.issues[0].message : (err as Error).message)
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)

async function uploadPoster(file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error('โปสเตอร์ต้องไม่เกิน 2 MB')
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('รองรับเฉพาะ JPG, PNG หรือ WebP')
  const path = `${new Date().getFullYear()}/${randomUUID()}.${file.type.split('/')[1]}`
  const db = adminClient()
  const { error } = await db.storage.from('posters').upload(path, file, { contentType: file.type })
  if (error) throw new Error('อัปโหลดโปสเตอร์ไม่สำเร็จ')
  return db.storage.from('posters').getPublicUrl(path).data.publicUrl
}

async function uniqueSlug(base: string, exceptId?: string) {
  const db = adminClient()
  let slug = base
  for (let i = 2; i < 50; i++) {
    const { data } = await db.from('events').select('id').eq('slug', slug).maybeSingle()
    if (!data || data.id === exceptId) return slug
    slug = `${base}-${i}`
  }
  return `${base}-${randomUUID().slice(0, 6)}`
}

const EventSchema = z.object({
  title: z.string().trim().max(120),
  category: z.enum(CATEGORY_KEYS as [string, ...string[]]),
  organizer: optText(80),
  summary: optText(120),
  benefit: optText(80),
  eligibility: optText(40),
  overview: optText(6000),
  apply_url: z.union([z.url('ลิงก์สมัครไม่ถูกต้อง'), z.literal('')]).optional().transform((v) => v || null),
  deadline: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional().transform((v) => v || null),
  open_note: optText(60),
  tags: z.array(z.enum(ROLE_KEYS as [string, ...string[]])),
  deadline_time: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal('')]).optional().transform((v) => v || '23:59'),
  event_start: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional().transform((v) => v || null),
  event_end: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional().transform((v) => v || null),
  location: optText(80),
  format: z.union([z.enum(['onsite', 'online', 'hybrid']), z.literal('')]).optional().transform((v) => v || null),
})

export async function saveEvent(_prev: State, form: FormData): Promise<State> {
  let dest: string
  try {
    const admin = await actionAdmin()
    const id = String(form.get('id') || '') || null
    const publish = form.get('intent') === 'publish'
    const v = EventSchema.parse({
      title: form.get('title') ?? '',
      category: form.get('category'),
      organizer: form.get('organizer') ?? '',
      summary: form.get('summary') ?? '',
      benefit: form.get('benefit') ?? '',
      eligibility: form.get('eligibility') ?? '',
      overview: form.get('overview') ?? '',
      apply_url: form.get('apply_url') ?? '',
      deadline: form.get('deadline') ?? '',
      open_note: form.get('open_note') ?? '',
      tags: form.getAll('tags'),
      deadline_time: form.get('deadline_time') ?? '',
      event_start: form.get('event_start') ?? '',
      event_end: form.get('event_end') ?? '',
      location: form.get('location') ?? '',
      format: form.get('format') ?? '',
    })
    if (v.event_start && v.event_end && v.event_end < v.event_start) throw new Error('วันสิ้นสุดกิจกรรมต้องไม่ก่อนวันเริ่ม')
    if (publish) {
      if (!v.title) throw new Error('กรุณาใส่ชื่องานก่อนเผยแพร่')
      if (!v.apply_url) throw new Error('กรุณาใส่ลิงก์สมัครก่อนเผยแพร่')
    }
    const flags = {
      is_club: form.get('is_club') === 'on',
      allow_teams: form.get('allow_teams') === 'on',
      featured: form.get('featured') === 'on',
      notify_on_publish: form.get('notify_on_publish') === 'on',
    }
    const db = adminClient()
    let existing: EventRow | null = null
    if (id) {
      const { data } = await db.from('events').select('*').eq('id', id).single()
      existing = data as EventRow
    }
    if (flags.featured && !existing?.featured) {
      const { data: feats } = await db.from('events').select('id, deadline, deadline_at').eq('featured', true).eq('status', 'published')
      const open = (feats || []).filter((f) => f.id !== id && !isClosed(f))
      if (open.length >= HOME_FEATURED_LIMIT) throw new Error(`หน้าแรกแสดงได้ ${HOME_FEATURED_LIMIT} งาน — เอาดาวงานอื่นออกก่อน`)
    }
    const { deadline_time, ...fields } = v
    const row: Record<string, unknown> = {
      ...fields,
      // exact closing moment in Thai time; the DB trigger keeps `deadline` in sync
      deadline_at: v.deadline ? new Date(`${v.deadline}T${deadline_time}:00+07:00`).toISOString() : null,
      title: v.title || 'งานใหม่ (ยังไม่ตั้งชื่อ)',
      ...flags,
      updated_by: admin.userId,
    }
    const poster = form.get('poster')
    if (poster instanceof File && poster.size > 0) row.poster_url = await uploadPoster(poster)
    if (publish) {
      row.status = 'published'
      if (!existing?.published_at) row.published_at = new Date().toISOString()
    } else if (!existing) {
      row.status = 'draft'
    }
    let saved: EventRow
    if (existing) {
      if (v.title && existing.title !== v.title && existing.status === 'draft') row.slug = await uniqueSlug(slugify(v.title), existing.id)
      const { data, error } = await db.from('events').update(row).eq('id', existing.id).select('*').single()
      if (error) throw new Error(error.message)
      saved = data as EventRow
    } else {
      row.slug = await uniqueSlug(slugify(v.title || 'event'))
      row.created_by = admin.userId
      const { data, error } = await db.from('events').insert(row).select('*').single()
      if (error) throw new Error(error.message)
      saved = data as EventRow
    }
    if (saved.status === 'published' && saved.notify_on_publish && !saved.notified_at && !isClosed(saved)) {
      after(() => notifyEventMatches(saved))
    }
    updateTag('events')
  revalidatePath('/', 'layout')
    dest = `/admin/events/${saved.id}?saved=${publish ? 'published' : 'draft'}`
  } catch (err) {
    return { error: errMsg(err) }
  }
  redirect(dest)
}

export async function unpublishEvent(form: FormData) {
  await actionAdmin()
  const id = z.uuid().parse(form.get('id'))
  await adminClient().from('events').update({ status: 'draft', featured: false }).eq('id', id)
  updateTag('events')
  revalidatePath('/', 'layout')
}

export async function deleteEvent(form: FormData) {
  await actionAdmin()
  const id = z.uuid().parse(form.get('id'))
  await adminClient().from('events').delete().eq('id', id)
  updateTag('events')
  revalidatePath('/', 'layout')
  redirect('/admin/events')
}

export async function toggleFeatured(id: string): Promise<{ featured?: boolean; error?: string }> {
  try {
    await actionAdmin()
    const db = adminClient()
    const { data: e } = await db.from('events').select('id, featured, status').eq('id', z.uuid().parse(id)).single()
    if (!e) throw new Error('ไม่พบงาน')
    if (!e.featured) {
      if (e.status !== 'published') throw new Error('เผยแพร่งานก่อนจึงขึ้นหน้าแรกได้')
      const { data: feats } = await db.from('events').select('id, deadline, deadline_at').eq('featured', true).eq('status', 'published')
      if ((feats || []).filter((f) => !isClosed(f)).length >= HOME_FEATURED_LIMIT)
        throw new Error(`หน้าแรกแสดงได้ ${HOME_FEATURED_LIMIT} งาน — เอาดาวงานอื่นออกก่อน`)
    }
    await db.from('events').update({ featured: !e.featured }).eq('id', e.id)
    updateTag('events')
  revalidatePath('/', 'layout')
    return { featured: !e.featured }
  } catch (err) {
    return { error: errMsg(err) }
  }
}

const POST_TABLES = { team: 'team_posts', seeker: 'seeker_posts', cofounder: 'cofounder_posts' } as const

export async function moderatePost(form: FormData) {
  await actionAdmin()
  const type = z.enum(['team', 'seeker', 'cofounder']).parse(form.get('type'))
  const id = z.uuid().parse(form.get('id'))
  const action = z.enum(['remove', 'restore']).parse(form.get('action'))
  const db = adminClient()
  const { data: post } = await db.from(POST_TABLES[type]).select('owner_id').eq('id', id).single()
  await db.from(POST_TABLES[type]).update({ status: action === 'remove' ? 'removed' : 'open' }).eq('id', id)
  if (action === 'remove' && post) {
    after(() =>
      notifyUsers([post.owner_id], 'system', {
        altText: 'ประกาศของคุณถูกนำออกโดยผู้ดูแล',
        title: 'ประกาศของคุณถูกนำออกโดยผู้ดูแล',
        subtitle: 'เนื้อหาอาจไม่เหมาะสมกับชุมชน หากคิดว่าผิดพลาด ติดต่อชมรมผ่าน LINE OpenChat',
        actions: [{ type: 'uri', label: 'ดูประกาศของฉัน', url: '/me?tab=posts' }],
      }),
    )
  }
  revalidatePath('/admin/community')
  revalidatePath('/teams')
  revalidatePath('/cofounder')
}

export async function setUserRole(form: FormData) {
  const admin = await actionAdmin()
  const id = z.uuid().parse(form.get('id'))
  const role = z.enum(['user', 'admin']).parse(form.get('role'))
  if (id === admin.userId && role !== 'admin') throw new Error('ลดสิทธิ์ตัวเองไม่ได้')
  await adminClient().from('profiles').update({ role }).eq('id', id)
  revalidatePath('/admin/users')
}

export async function setSuspended(form: FormData) {
  const admin = await actionAdmin()
  const id = z.uuid().parse(form.get('id'))
  if (id === admin.userId) throw new Error('ระงับบัญชีตัวเองไม่ได้')
  const suspended = form.get('suspended') === '1'
  const db = adminClient()
  await db.from('profiles').update({ is_suspended: suspended }).eq('id', id)
  if (suspended) {
    // Hide their public posts while suspended.
    for (const t of Object.values(POST_TABLES)) await db.from(t).update({ status: 'closed' }).eq('owner_id', id).eq('status', 'open')
  }
  revalidatePath('/admin/users')
}

const BroadcastSchema = z.object({
  title: z.string().trim().min(1, 'กรุณาใส่หัวข้อ').max(80),
  body: z.string().trim().min(1, 'กรุณาใส่ข้อความ').max(1000),
  url: z.union([z.string().trim().regex(/^(https?:\/\/|\/)/, 'ลิงก์ต้องขึ้นต้นด้วย https:// หรือ /'), z.literal('')]).optional().transform((v) => v || null),
  audience: z.enum(['subscribers', 'all', 'saved_event']),
  audience_event_id: z.union([z.uuid(), z.literal('')]).optional().transform((v) => v || null),
})

export async function sendBroadcast(_prev: State, form: FormData): Promise<State> {
  try {
    const admin = await actionAdmin()
    const v = BroadcastSchema.parse({
      title: form.get('title'),
      body: form.get('body'),
      url: form.get('url') ?? '',
      audience: form.get('audience'),
      audience_event_id: form.get('audience_event_id') ?? '',
    })
    if (v.audience === 'saved_event' && !v.audience_event_id) throw new Error('กรุณาเลือกงาน')
    const send_line = form.get('send_line') === 'on'
    const send_email = form.get('send_email') === 'on'
    if (!send_line && !send_email) throw new Error('เลือกช่องทางอย่างน้อย 1 ช่องทาง')
    let image_url: string | null = null
    const image = form.get('image')
    if (image instanceof File && image.size > 0) image_url = await uploadPoster(image)

    const db = adminClient()
    let ids: string[] = []
    if (v.audience === 'saved_event') {
      const { data } = await db.from('saved_events').select('user_id').eq('event_id', v.audience_event_id!)
      ids = (data || []).map((r) => r.user_id)
    } else {
      let q = db.from('profiles').select('id').eq('is_suspended', false).limit(10000)
      if (v.audience === 'subscribers') q = q.eq('notify_announcements', true)
      const { data } = await q
      ids = (data || []).map((r) => r.id)
    }
    if (!ids.length) throw new Error('ไม่มีผู้รับในกลุ่มนี้')

    const { data: b, error } = await db
      .from('broadcasts')
      .insert({ ...v, image_url, send_line, send_email, created_by: admin.userId })
      .select('id')
      .single()
    if (error || !b) throw new Error('บันทึกประกาศไม่สำเร็จ')
    const stats = await notifyUsers(
      ids,
      'announcements',
      {
        altText: v.title,
        headerBar: 'ประกาศจากชมรม',
        title: v.title,
        subtitle: v.body,
        imageUrl: image_url,
        actions: v.url ? [{ type: 'uri', label: 'ดูรายละเอียด', url: v.url }] : [{ type: 'uri', label: 'เปิดเว็บ', url: '/' }],
      },
      // "ทุกคน" is for important notices: ignore topic switches but still respect channel availability.
      { ignorePrefs: v.audience !== 'subscribers', allowLine: send_line, allowEmail: send_email, broadcastId: b.id },
    )
    await db.from('broadcasts').update({ stats: { ...stats, recipients: ids.length }, sent_at: new Date().toISOString() }).eq('id', b.id)
    revalidatePath('/admin/broadcasts')
    return { ok: `ส่งแล้ว · LINE ${stats.line} · อีเมล ${stats.email} (เข้าคิว ทยอยส่งอัตโนมัติ) · สรุปรายวัน ${stats.digest} · ข้าม ${stats.skipped}${stats.failed ? ` · ล้มเหลว ${stats.failed}` : ''}` }
  } catch (err) {
    return { error: errMsg(err) }
  }
}

export async function resendEventMatches(form: FormData) {
  await actionAdmin()
  const id = z.uuid().parse(form.get('id'))
  const { data } = await adminClient().from('events').select('*').eq('id', id).single()
  if (data && data.status === 'published') after(() => notifyEventMatches(data as EventRow))
  revalidatePath(`/admin/events/${id}`)
}
