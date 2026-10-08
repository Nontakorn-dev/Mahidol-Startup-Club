import 'server-only'
import { env } from '@/lib/env'

// Polite fetching shared by every importer:
//  • identifies itself (bot name + contact URL) — never pretends to be a browser
//  • obeys robots.txt for `*` and for our bot name, re-read on every sync
//  • one request at a time with a pause between pages, stops on 403/429
//  • never touches login, CAPTCHA or Cloudflare challenge pages

export const BOT_NAME = 'MahidolStartupClubBot'
export const BOT_UA = `Mozilla/5.0 (compatible; ${BOT_NAME}/1.0; +${env.siteUrl}; student club opportunity listing)`

export class SourceBlocked extends Error {}

export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Rule = { allow: boolean; re: RegExp; len: number }
const robotsCache = new Map<string, Promise<Rule[] | 'deny-all'>>()

function ruleRegex(path: string) {
  const anchored = path.endsWith('$')
  const body = (anchored ? path.slice(0, -1) : path)
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${body}${anchored ? '$' : ''}`)
}

/** Rules that apply to us: the group naming our bot if there is one, else the `*` group. */
export function parseRobots(txt: string): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = []
  let cur: { agents: string[]; rules: Rule[] } | null = null
  let lastWasAgent = false
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim()
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const value = m[2].trim()
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], rules: [] }))
      cur.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!cur || (key !== 'allow' && key !== 'disallow')) continue
    if (!value) continue // "Disallow:" (empty) allows everything
    cur.rules.push({ allow: key === 'allow', re: ruleRegex(value), len: value.length })
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && BOT_NAME.toLowerCase().includes(a)))
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes('*'))
  return chosen.flatMap((g) => g.rules)
}

async function loadRobots(origin: string): Promise<Rule[] | 'deny-all'> {
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': BOT_UA }, cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (res.status >= 500) return 'deny-all' // be safe while their server is struggling
    if (!res.ok) return [] // no robots.txt → everything allowed
    return parseRobots(await res.text())
  } catch {
    return 'deny-all'
  }
}

export async function robotsAllows(url: string): Promise<boolean> {
  const u = new URL(url)
  if (!robotsCache.has(u.origin)) robotsCache.set(u.origin, loadRobots(u.origin))
  const rules = await robotsCache.get(u.origin)!
  if (rules === 'deny-all') return false
  const path = u.pathname + u.search
  const hit = rules.filter((r) => r.re.test(path)).sort((a, b) => b.len - a.len || Number(b.allow) - Number(a.allow))[0]
  return hit ? hit.allow : true
}

/** Forget cached robots.txt (call at the start of each sync so changes are picked up). */
export function resetRobots() {
  robotsCache.clear()
}

/** GET a page or JSON document politely. Throws SourceBlocked on robots/403/429/challenge pages. */
export async function politeGet(url: string, accept = 'text/html', timeoutMs = 20_000): Promise<string> {
  if (!(await robotsAllows(url))) throw new SourceBlocked(`robots.txt disallows ${new URL(url).pathname}`)
  const res = await fetch(url, {
    headers: { 'User-Agent': BOT_UA, Accept: accept, 'Accept-Language': 'th,en;q=0.8' },
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (res.status === 403 || res.status === 429 || res.status === 503) {
    // Say *why* (Cloudflare challenge / WAF block / rate limit) so the admin page shows the real cause.
    const mitigated = res.headers.get('cf-mitigated')
    const retry = res.headers.get('retry-after')
    const title = (await res.text().catch(() => '')).match(/<title[^>]*>([^<]{0,80})/i)?.[1]?.trim()
    const why = mitigated ? `Cloudflare ${mitigated}` : res.headers.get('server')?.toLowerCase().includes('cloudflare') ? 'Cloudflare' : null
    const detail = [why, title && `“${title}”`, retry && `retry-after ${retry}s`].filter(Boolean).join(' · ')
    throw new SourceBlocked(`${new URL(url).hostname} responded ${res.status}${detail ? ` (${detail})` : ''} — backing off until the next run`)
  }
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status} for ${new URL(url).pathname}`)
  const body = await res.text()
  if (/cf-chl-|challenge-platform|captcha/i.test(body.slice(0, 4000)) && accept.includes('html')) {
    throw new SourceBlocked(`${new URL(url).hostname} served a bot challenge — not bypassing it`)
  }
  return body
}
