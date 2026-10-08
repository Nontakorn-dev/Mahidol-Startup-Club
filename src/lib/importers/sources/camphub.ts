import 'server-only'
import { todayBangkok } from '@/lib/format'
import { pause, politeGet } from '../http'
import { RELEVANCE_THRESHOLD, scoreRelevance } from '../relevance'
import { cleanValue, deadlineFromText, decodeEntities, htmlToText, thaiDates } from '../text'
import type { Level, Source, SourceItem } from '../types'

// CAMPHUB (https://www.camphub.in.th) — long-running Thai camp / contest / workshop listing,
// written up by its editorial team.
//  • robots.txt has no rules for other bots → crawling allowed. WordPress REST API is public
//    (/wp-json/wp/v2/posts) so the listing comes from one JSON request, not page scraping.
//  • Server-side filter: tags ปริญญาตรี / บุคคลทั่วไป / ค่ายเด็กมหาลัย, excluding "timeout" (closed)
//    and open-house / tutoring / exam-simulation categories.
//  • The closing date, organiser and eligibility are only on the post page, so that page is
//    fetched — only for listings that already look relevant, at most a few per run.

const ORIGIN = 'https://www.camphub.in.th'
const MAX_PAGES = 12
const TAG = { bachelor: 502, public: 289, university: 968, timeout: 1335 }
const EXCLUDED_CATEGORIES = [656, 148, 2119] // openhouse, tutor, exam-simulation

type WpPost = {
  id: number
  date: string
  modified: string
  link: string
  title: { rendered: string }
  content: { rendered: string }
  class_list: string[]
}

function levelsFrom(classes: string[]): Level[] {
  const out = new Set<Level>()
  for (const c of classes) {
    if (c === 'tag-bachelor' || c === 'tag-university' || c === 'tag-high-vocational') out.add('university')
    else if (c === 'tag-public') out.add('public')
    else if (/^tag-(mattayom|primary)-/.test(c)) out.add('high_school')
  }
  return [...out]
}

const NOISE = /^(อย่าลืมแอดไลน์.*|คำอธิบายกิจกรรม|CAMPHUB ไม่ได้เป็นผู้จัดกิจกรรมนี้.*)$/gm
const OWN_LINKS = /camphub\.in\.th|lin\.ee\/|line\.me\/(R\/)?ti\/p\/%40camphub|facebook\.com\/camphub|wp\.me\//i
const APPLY_HINT = /forms\.gle|docs\.google\.com\/forms|forms\.office|regist|apply|eventpop|zipevent|bit\.ly|linktr\.ee|qrco\.de|tinyurl/i

function applyLink(contentHtml: string): string | null {
  const links = [
    ...[...contentHtml.matchAll(/href="([^"]+)"/g)].map((m) => decodeEntities(m[1])),
    ...(htmlToText(contentHtml).match(/https?:\/\/[^\s)]+/g) || []),
  ].filter((u) => /^https?:\/\//.test(u) && !OWN_LINKS.test(u))
  return links.find((u) => APPLY_HINT.test(u)) ?? links[0] ?? null
}

function fromPost(p: WpPost): SourceItem {
  const description = htmlToText(p.content.rendered).replace(NOISE, '').replace(/\n{3,}/g, '\n\n').trim()
  const classes = p.class_list ?? []
  return {
    source_id: String(p.id),
    source_url: p.link,
    source_type: classes.includes('category-contest') ? 'contest' : classes.includes('category-skills-workshop') ? 'workshop' : 'camp',
    title: decodeEntities(p.title.rendered).trim(),
    organizer: null,
    description: description || null,
    poster_url: null,
    apply_url: applyLink(p.content.rendered),
    deadline_at: null,
    deadline: null,
    event_start: null,
    event_end: null,
    location: null,
    format: classes.includes('tag-online-activity') || classes.includes('category-online') ? 'online' : null,
    prize: null,
    eligibility: null,
    levels: levelsFrom(classes),
    open: !classes.includes('tag-timeout'),
    hints: classes.filter((c) => /^tag-contest-|^category-(contest|account-commerce|computer|skills-workshop)$/.test(c)).map((c) => c.replace(/^(tag|category)-/, '').replace(/-/g, ' ')),
    typeBonus: classes.includes('tag-contest-idea-business') ? 4 : classes.includes('tag-contest-innovation') || classes.includes('tag-contest-hackathon') ? 2 : 0,
    version: p.modified,
    raw: { id: p.id, date: p.date, modified: p.modified, link: p.link, class_list: classes },
  }
}

/**
 * Label → value pairs of the post's info block. Two templates exist:
 *  • classic: `<h6><strong>วันที่รับสมัครวันสุดท้าย</strong></h6><h4>ศุกร์ 16 ตุลาคม 2569</h4>`
 *  • "chv2":  `<div class="fk">จัดโดย</div><div class="fv"><b>…</b></div>` plus
 *             `data-regto="2026-11-08" data-regtime="" data-evlast="2026-11-21"` on the countdown.
 */
export function camphubFacts(html: string): Record<string, string> {
  const out: Record<string, string> = {}
  const put = (label: string, valueHtml: string) => {
    const value = htmlToText(
      valueHtml
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<sup>[\s\S]*?<\/sup>/g, '')
        .replace(/<a[^>]*>(เปิดแผนที่|ดูรายละเอียด[^<]*)<\/a>/g, ''),
    )
      .replace(/\(\s*อยู่ตรงไหน\?\s*\)|ดูรายละเอียดรางวัลด้านล่าง/g, '')
      .replace(/^\/\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (label && value && !(label in out)) out[label.trim()] = value
  }
  for (const m of html.matchAll(/<h6[^>]*>\s*<strong>([^<]+)<\/strong>[\s\S]*?<\/h6>\s*<h4[^>]*>([\s\S]*?)<\/h4>/g)) put(m[1], m[2])
  for (const m of html.matchAll(/<div class="fk">([^<]+)<\/div>\s*<div class="fv">([\s\S]*?)<\/div>/g)) put(m[1], m[2])
  const byline = html.match(/<div class="byline">จัดโดย\s*<b>([\s\S]*?)<\/b>/)?.[1]
  if (byline) put('จัดโดย', byline)
  for (const attr of ['regto', 'regtime', 'evlast']) {
    const v = html.match(new RegExp(`data-${attr}="([^"]*)"`))?.[1]
    if (v) out[`data-${attr}`] = v
  }
  const apply = html.match(/<a class="btn ch-apply" href="([^"]+)"/)?.[1]
  if (apply) out['apply'] = decodeEntities(apply)
  return out
}

const pick = (f: Record<string, string>, ...keys: string[]) => keys.map((k) => f[k]).find(Boolean) ?? null

function enrich(it: SourceItem, html: string): SourceItem {
  const f = camphubFacts(html)
  const regto = /^\d{4}-\d{2}-\d{2}$/.test(f['data-regto'] ?? '') ? f['data-regto'] : null
  const regtime = /^\d{1,2}:\d{2}$/.test(f['data-regtime'] ?? '') ? f['data-regtime'].padStart(5, '0') : null
  const deadline = regto ?? thaiDates(pick(f, 'วันที่รับสมัครวันสุดท้าย') ?? '')[0] ?? deadlineFromText(it.description) ?? null
  const eventDates = thaiDates(pick(f, 'แข่งเมื่อไหร่', 'จัดเมื่อไหร่', 'วันที่จัดกิจกรรม', 'วันที่จัด') ?? '')
  const evlast = /^\d{4}-\d{2}-\d{2}$/.test(f['data-evlast'] ?? '') ? f['data-evlast'] : null
  const where = pick(f, 'แข่งที่ไหน', 'จัดที่ไหน', 'สถานที่จัดกิจกรรม')
  const mode = `${pick(f, 'รูปแบบกิจกรรม') ?? ''} ${where ?? ''}`
  const format: SourceItem['format'] = /ออนไลน์/.test(mode) && /สถานที่จริง|ออนไซต์|โรงแรม|มหาวิทยาลัย|อาคาร/.test(mode) ? 'hybrid' : /ออนไลน์/.test(mode) ? 'online' : where || /สถานที่จริง/.test(mode) ? 'onsite' : it.format
  const poster = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? html.match(/(?:wp-post-image|class="hero")[\s\S]{0,600}?data-src="([^"]+)"/)?.[1] ?? null
  const fee = pick(f, 'ค่าใช้จ่าย', 'ค่าสมัคร')
  const prize = pick(f, 'รางวัล')
  const start = eventDates[0] ?? null
  const end = evlast ?? (eventDates.length > 1 ? eventDates[eventDates.length - 1] : null)
  return {
    ...it,
    organizer: cleanValue(pick(f, 'จัดโดย', 'กิจกรรมนี้จัดโดย')),
    apply_url: f['apply'] ?? it.apply_url,
    deadline,
    deadline_at: deadline && regtime && deadline === regto ? `${deadline}T${regtime}:00+07:00` : null,
    open: it.open && (!deadline || deadline >= todayBangkok()),
    event_start: start,
    event_end: end && end !== start ? end : null,
    location: cleanValue(where) ?? (format === 'online' ? 'ออนไลน์' : null),
    format,
    eligibility: cleanValue(pick(f, 'ใครสมัครได้', 'คุณสมบัติ')),
    prize: prize ?? (fee && !/ฟรี/.test(fee) ? `ค่าสมัคร ${fee}` : null),
    poster_url: poster ? decodeEntities(poster) : null,
    flags: deadline && !regto && !f['วันที่รับสมัครวันสุดท้าย'] ? [...(it.flags ?? []), 'date_from_text'] : it.flags,
    raw: { ...(it.raw as object), facts: f },
  }
}

export const camphub: Source = {
  key: 'camphub',
  name: 'CAMPHUB',
  homepage: `${ORIGIN}/type/contest/`,
  trust: 'high',
  note: 'ทีมงานเขียนประกาศเอง ข้อมูลครบ (วันปิดรับ ผู้จัด คุณสมบัติ) แต่ส่วนใหญ่เป็นงานเด็ก ม.ปลาย — ระบบกรองเหลือระดับมหาวิทยาลัย',
  async fetch({ known, until }) {
    const after = new Date(Date.now() - 150 * 86_400_000).toISOString().slice(0, 19)
    const q = new URLSearchParams({
      per_page: '100',
      tags: [TAG.bachelor, TAG.public, TAG.university].join(','),
      tags_exclude: String(TAG.timeout),
      categories_exclude: EXCLUDED_CATEGORIES.join(','),
      after,
      _fields: 'id,date,modified,link,title,content,class_list',
    })
    const posts = JSON.parse(await politeGet(`${ORIGIN}/wp-json/wp/v2/posts?${q}`, 'application/json')) as WpPost[]
    const items: SourceItem[] = []
    const seen: string[] = []
    let pages = 0
    for (const p of posts) {
      const it = fromPost(p)
      const k = known.get(it.source_id)
      if (k && k.version === it.version) {
        seen.push(it.source_id)
        continue
      }
      // Only open the post page for listings that already look relevant.
      if (scoreRelevance(it).score < RELEVANCE_THRESHOLD) {
        items.push(it)
        continue
      }
      if (pages >= MAX_PAGES || Date.now() > until) continue // next run
      await pause(800)
      pages++
      items.push(enrich(it, await politeGet(p.link)))
    }
    return { items, seen, scanned: posts.length }
  },
}
