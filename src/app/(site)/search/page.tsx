import Link from 'next/link'
import { Suspense } from 'react'
import { after } from 'next/server'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Crumbs from '@/components/Crumbs'
import SearchBox from '@/components/SearchBox'
import { CofounderCardView, EmptyState, EventCard, SeekerCardView, TeamCardView } from '@/components/Cards'
import { IconArrowRight, IconClose, IconPlus, IconSparkle } from '@/components/icons'
import { getViewer } from '@/lib/auth'
import { decodeIntent, encodeIntent, parseIntent, type Engine, type Intent, type ParseStatus, type Target } from '@/lib/ai/intent'
import { addChipHref, intentChips, runSearch, type SearchResults } from '@/lib/search'
import { adminClient } from '@/lib/supabase/admin'
import { CATEGORIES, CATEGORY_KEYS, ROLES, ROLE_KEYS } from '@/lib/constants'
import { ATTR_LABEL, ATTRS } from '@/lib/topics'

export const metadata: Metadata = { title: 'ผลการค้นหา' }
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const TAB_LABEL: Record<Target, string> = { events: 'งานแข่ง & ทุน', teams: 'ทีม', people: 'คน', cofounder: 'Co-founder' }

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 300) : ''
  return (
    <div className="bg-soft">
      <section className="page-head">
        <div className="inner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 18 }}>
          <Crumbs back="/" trail={[{ label: 'หน้าแรก', href: '/' }, { label: 'ค้นหา' }]} />
          <h1>{q ? 'ผลที่ตรงกับคุณ' : 'อยากทำอะไรต่อ?'}</h1>
          <SearchBox key={q} id="q3" defaultValue={q} maxWidth={760} />
        </div>
      </section>
      <div className="container" style={{ paddingTop: 28, paddingBottom: 96 }}>
        {q ? (
          <Suspense key={q} fallback={<ResultsSkeleton />}>
            <Results q={q} f={typeof sp.f === 'string' ? sp.f : null} tab={typeof sp.tab === 'string' ? sp.tab : null} scope={typeof sp.scope === 'string' ? sp.scope : null} />
          </Suspense>
        ) : (
          <EmptyState
            title="พิมพ์สิ่งที่อยากทำเป็นประโยคได้เลย"
            body="เช่น “หาทีมลง TED Youth Startup ฉันทำ UX ได้ ขาด dev 2 คน” หรือ “อยากได้ technical co-founder สาย HealthTech”"
          />
        )}
      </div>
    </div>
  )
}

function ResultsSkeleton() {
  return (
    <div className="stack" style={{ gap: 20 }} aria-busy="true">
      <div className="row" style={{ gap: 10, color: 'var(--brand)', fontWeight: 600 }}>
        <span className="spin" style={{ display: 'inline-flex' }}>
          <IconSparkle size={18} />
        </span>
        กำลังหาสิ่งที่ตรงกับคุณ…
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        {[120, 90, 140].map((w) => (
          <span key={w} className="loading-shimmer" style={{ width: w, height: 36, borderRadius: 999 }} />
        ))}
      </div>
      <div className="grid-events">
        {[0, 1, 2].map((i) => (
          <div key={i} className="loading-shimmer" style={{ height: 380 }} />
        ))}
      </div>
    </div>
  )
}

async function Results({ q, f, tab, scope }: { q: string; f: string | null; tab: string | null; scope: string | null }) {
  const viewer = await getViewer()
  let intent: Intent | null = f ? await decodeIntent(f) : null
  let usedFallback = false
  let engine: Engine = 'cache'
  let status: ParseStatus = 'ok'
  let message: string | undefined
  if (!intent) {
    const h = await headers()
    const actor = viewer?.userId ?? h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'
    const parsed = await parseIntent(q, actor)
    intent = parsed.intent
    usedFallback = parsed.usedFallback
    engine = parsed.engine
    status = parsed.status
    message = parsed.message
  }
  if (status !== 'ok') {
    after(async () => {
      await adminClient().from('search_logs').insert({ user_id: viewer?.userId ?? null, query: q.slice(0, 300), used_fallback: false, source: 'web', engine, status })
    })
    return <RejectedQuery message={message ?? ''} />
  }
  const results = await runSearch(intent, viewer?.userId ?? null)
  const counts = {
    events: results.events.length,
    teams: results.teams.length,
    people: results.people.length,
    cofounder: results.cofounders.length,
  }
  if (!f) {
    const parsedIntent = intent
    after(async () => {
      await adminClient()
        .from('search_logs')
        .insert({
          user_id: viewer?.userId ?? null,
          query: q,
          parsed: parsedIntent,
          confidence: parsedIntent.confidence,
          used_fallback: usedFallback,
          result_counts: counts,
          source: 'web',
          engine,
          status,
        })
    })
  }

  const scopeTarget: Target | null =
    scope === 'teams' ? (intent.roles_needed.length ? 'people' : 'teams') : scope === 'cofounder' ? 'cofounder' : scope === 'events' ? 'events' : null
  const order: Target[] = [...new Set([...(scopeTarget ? [scopeTarget] : []), ...intent.targets, 'events', 'teams', 'people', 'cofounder'] as Target[])]
  const firstWithResults = order.find((t) => counts[t] > 0) ?? order[0]
  const active: Target = (['events', 'teams', 'people', 'cofounder'] as string[]).includes(tab ?? '') ? (tab as Target) : firstWithResults
  const chips = intentChips(intent, q, results.focusEvent?.title)
  const base = `/search?q=${encodeURIComponent(q)}&f=${f ?? encodeIntent(intent)}${scope ? `&scope=${scope}` : ''}`
  const loggedIn = Boolean(viewer)

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="row muted" style={{ fontSize: 14, gap: 6 }}>
            <span style={{ color: 'var(--brand)', display: 'inline-flex' }}>
              <IconSparkle size={16} />
            </span>
            {usedFallback ? 'ค้นจากคำสำคัญ' : 'เข้าใจว่าคุณกำลัง'}
          </span>
          {intent.summary && <b style={{ fontSize: 15 }}>{intent.summary}</b>}
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          {chips.map((c) => (
            <span key={c.key} className="intent-chip">
              <span className="k">{c.kind}</span>
              {c.label}
              <Link href={c.removeHref} aria-label={`เอาตัวกรอง ${c.label} ออก`} scroll={false}>
                <IconClose size={14} />
              </Link>
            </span>
          ))}
          <details style={{ position: 'relative' }}>
            <summary className="intent-chip" style={{ cursor: 'pointer', listStyle: 'none', paddingRight: 12 }}>
              <IconPlus size={14} /> เพิ่มตัวกรอง
            </summary>
            <div className="menu-pop" style={{ left: 0, right: 'auto', minWidth: 260, maxHeight: 360, overflow: 'auto' }}>
              <span className="muted" style={{ fontSize: 12, padding: '4px 12px' }}>ประเภทงาน</span>
              {CATEGORY_KEYS.filter((c) => !intent.categories.includes(c)).map((c) => (
                <Link key={c} href={addChipHref(intent, q, { categories: [...intent.categories, c] })}>
                  {CATEGORIES[c]}
                </Link>
              ))}
              <span className="muted" style={{ fontSize: 12, padding: '4px 12px' }}>ฉันทำได้</span>
              {ROLE_KEYS.filter((r) => !intent.my_skills.includes(r)).map((r) => (
                <Link key={`m${r}`} href={addChipHref(intent, q, { my_skills: [...intent.my_skills, r] })}>
                  {ROLES[r]}
                </Link>
              ))}
              <span className="muted" style={{ fontSize: 12, padding: '4px 12px' }}>ทีมขาด</span>
              {ROLE_KEYS.filter((r) => !intent.roles_needed.includes(r)).map((r) => (
                <Link key={`n${r}`} href={addChipHref(intent, q, { roles_needed: [...intent.roles_needed, r] })}>
                  {ROLES[r]}
                </Link>
              ))}
              <span className="muted" style={{ fontSize: 12, padding: '4px 12px' }}>เงื่อนไข</span>
              {ATTRS.filter((a) => !intent.attrs.includes(a)).map((a) => (
                <Link key={`a${a}`} href={addChipHref(intent, q, { attrs: [...intent.attrs, a] })}>
                  {ATTR_LABEL[a]}
                </Link>
              ))}
              {!intent.include_closed && <Link href={addChipHref(intent, q, { include_closed: true })}>รวมงานที่ปิดรับแล้ว</Link>}
            </div>
          </details>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          ไม่ตรงใจ? กดลบหรือเพิ่มชิปได้เลย ผลจะเปลี่ยนตามทันที
        </p>
      </div>

      <Suggestion intent={intent} results={results} />

      <TopPicks results={results} />

      <div role="tablist" aria-label="ผลการค้นหา" className="segmented" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
        {(['events', 'teams', 'people', 'cofounder'] as Target[]).map((t) => (
          <Link key={t} href={`${base}&tab=${t}`} role="tab" aria-selected={active === t} scroll={false}>
            {TAB_LABEL[t]} <span className="n">{counts[t]}</span>
          </Link>
        ))}
      </div>

      {active === 'events' &&
        (results.events.length ? (
          <div className="grid-events">
            {results.events.map((r) => (
              <EventCard key={r.item.id} e={r.item} reason={r.reason} />
            ))}
          </div>
        ) : (
          <EmptyState title="ไม่พบงานที่ตรงกับตัวกรอง" body="ลองเอาชิปบางอันออก หรือดูงานทั้งหมด" action={<Link href="/opportunities" className="btn btn-outline btn-pill">ดูงานแข่ง & ทุนทั้งหมด</Link>} />
        ))}
      {active === 'teams' &&
        (results.teams.length ? (
          <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))' }}>
            {results.teams.map((r) => (
              <TeamCardView key={r.item.id} t={r.item} loggedIn={loggedIn} reason={r.reason} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="ยังไม่มีทีมที่ตรงกับคุณ"
            body="ลองประกาศว่าคุณกำลังหาทีม แล้วให้ทีมที่ขาดคนแบบคุณทักมา"
            action={<Link href={`/teams/new?as=member${results.focusEvent ? `&event=${results.focusEvent.id}` : ''}`} className="btn btn-primary btn-pill">ประกาศหาทีม</Link>}
          />
        ))}
      {active === 'people' &&
        (results.people.length ? (
          <div className="grid-cards">
            {results.people.map((r) => (
              <SeekerCardView key={r.item.id} s={r.item} loggedIn={loggedIn} reason={r.reason} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="ยังไม่มีคนที่ตรงกับตำแหน่งที่ขาด"
            body="ประกาศชวนคนเข้าทีม แล้วคนที่ใช่จะเจอประกาศของคุณจากช่องค้นหาของเขาเอง"
            action={<Link href={`/teams/new${results.focusEvent ? `?event=${results.focusEvent.id}` : ''}`} className="btn btn-primary btn-pill">ชวนคนเข้าทีม</Link>}
          />
        ))}
      {active === 'cofounder' &&
        (results.cofounders.length ? (
          <div className="grid-cards">
            {results.cofounders.map((r) => (
              <CofounderCardView key={r.item.id} c={r.item} loggedIn={loggedIn} reason={r.reason} />
            ))}
          </div>
        ) : (
          <EmptyState title="ยังไม่มีโปรไฟล์ co-founder ที่ตรง" action={<Link href="/cofounder/new" className="btn btn-primary btn-pill">สร้างโปรไฟล์ Co-founder</Link>} />
        ))}
    </div>
  )
}

/** "พาไปหน้านั้นเลย" — the page the intent most likely wants. */
function Suggestion({ intent, results }: { intent: Intent; results: SearchResults }) {
  const e = results.focusEvent
  const wantsTeam = intent.targets.some((t) => t === 'teams' || t === 'people')
  let href: string | null = null
  let title = ''
  let sub = ''
  if (e) {
    href = `/opportunities/${e.slug}${wantsTeam && e.allow_teams ? '#teams' : ''}`
    title = e.title
    sub = wantsTeam ? 'ดูรายละเอียดงาน และทีมที่กำลังมองหาคนสำหรับงานนี้' : 'ดูรายละเอียดและสมัครได้เลย'
  } else if (intent.targets[0] === 'cofounder') {
    href = '/teams?tab=cofounder'
    title = 'หน้า Co-founder'
    sub = 'คนที่กำลังมองหาคนร่วมก่อตั้งสตาร์ตอัพ'
  } else if (intent.targets[0] === 'people' || intent.roles_needed.length) {
    href = '/teams/new'
    title = 'ชวนคนเข้าทีม'
    sub = 'ประกาศตำแหน่งที่ทีมขาด ให้คนที่ใช่เจอคุณ'
  }
  if (!href) return null
  return (
    <Link
      href={href}
      className="row"
      style={{
        gap: 16,
        padding: '16px 20px',
        borderRadius: 20,
        background: 'linear-gradient(120deg, #0A2558 0%, #0035AD 100%)',
        color: '#fff',
        textDecoration: 'none',
        boxShadow: '0 16px 40px -18px rgba(0,53,173,0.6)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.4 }}>
        <span style={{ fontSize: 12, color: '#FFC726', fontWeight: 600 }}>พาไปหน้าที่ตรงที่สุด</span>
        <span className="head" style={{ fontSize: 20, fontWeight: 500 }}>
          {title}
        </span>
        <span style={{ fontSize: 14, color: '#D6E0F5' }}>{sub}</span>
      </span>
      <span className="btn btn-orange btn-pill" style={{ flex: 'none' }}>
        ไปเลย <IconArrowRight size={16} />
      </span>
    </Link>
  )
}

const EXAMPLES = ['หาทีมลง hackathon ฉันทำ UX ได้ ขาด dev', 'ทุนสตาร์ตอัพที่ปิดรับเดือนนี้', 'อยากได้ technical co-founder สาย HealthTech', 'workshop ธุรกิจ ใกล้ปิดรับ']

/** Input the search can't use (empty, abusive, off-topic…): explain and offer examples. */
function RejectedQuery({ message }: { message: string }) {
  return (
    <section className="box" style={{ gap: 14, maxWidth: 760 }}>
      <b style={{ fontSize: 17 }}>{message}</b>
      <div className="row wrap" style={{ gap: 8 }}>
        {EXAMPLES.map((ex) => (
          <Link key={ex} href={`/search?q=${encodeURIComponent(ex)}`} className="filter-chip">
            {ex}
          </Link>
        ))}
      </div>
    </section>
  )
}

/** Best match from each tab, with the rule-based “แนะนำเพราะ” (no extra model call). */
function TopPicks({ results }: { results: SearchResults }) {
  const picks: { key: string; type: string; title: string; href: string; reason: string }[] = []
  for (const r of results.events.slice(0, 2).filter((r) => r.score >= 3))
    picks.push({ key: `e${r.item.id}`, type: 'งาน', title: r.item.title, href: `/opportunities/${r.item.slug}`, reason: r.reason })
  for (const r of results.teams.slice(0, 1).filter((r) => r.score >= 3))
    picks.push({ key: `t${r.item.id}`, type: 'ทีม', title: r.item.name, href: `/teams?tab=teams${r.item.event ? `&event=${r.item.event.id}` : ''}`, reason: r.reason })
  for (const r of results.people.slice(0, 1).filter((r) => r.score >= 3))
    picks.push({ key: `p${r.item.id}`, type: 'คน', title: r.item.author.name, href: '/teams?tab=people', reason: r.reason })
  for (const r of results.cofounders.slice(0, 1).filter((r) => r.score >= 3))
    picks.push({ key: `c${r.item.id}`, type: 'Co-founder', title: r.item.idea_title || r.item.author.name, href: '/teams?tab=cofounder', reason: r.reason })
  if (picks.length < 2) return null
  return (
    <section className="box" style={{ background: '#fff', gap: 10 }}>
      <h2 className="row" style={{ gap: 8 }}>
        <span style={{ color: 'var(--brand)', display: 'inline-flex' }}>
          <IconSparkle size={18} />
        </span>
        แนะนำสำหรับคุณ
      </h2>
      {picks.map((p) => (
        <Link key={p.key} href={p.href} className="todo" style={{ padding: '12px 4px' }}>
          <span className="tag tag-blue tag-sm">{p.type}</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.4 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{p.title}</span>
            <span className="muted" style={{ fontSize: 13 }}>
              แนะนำเพราะ {p.reason}
            </span>
          </span>
          <IconArrowRight size={16} />
        </Link>
      ))}
    </section>
  )
}
