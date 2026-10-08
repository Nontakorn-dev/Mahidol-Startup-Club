import 'server-only'
import { env, serverEnv } from '@/lib/env'
import { hmacBase64, safeEqual } from '@/lib/crypto'

// LINE Messaging API helpers + Flex Message builders styled after LineMessages.html.

const API = 'https://api.line.me/v2/bot'
const BRAND = '#0035AD'
const NAVY = '#10233F'
const MUTED = '#64748B'
const YELLOW = '#FFC726'

type LineMessage = Record<string, unknown>

async function call(path: string, body: unknown) {
  const token = serverEnv().lineMessagingToken
  if (!token) throw new Error('LINE Messaging API is not configured')
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LINE ${path} ${res.status}: ${text.slice(0, 300)}`)
  }
  return res
}

export async function pushMessage(to: string, messages: LineMessage[]) {
  await call('/message/push', { to, messages: messages.slice(0, 5) })
}

/** Multicast in chunks of 500 (LINE limit). Returns number of recipients attempted. */
export async function multicast(to: string[], messages: LineMessage[]) {
  for (let i = 0; i < to.length; i += 500) {
    await call('/message/multicast', { to: to.slice(i, i + 500), messages: messages.slice(0, 5) })
  }
  return to.length
}

export async function replyMessage(replyToken: string, messages: LineMessage[]) {
  await call('/message/reply', { replyToken, messages: messages.slice(0, 5) })
}

export function verifyLineSignature(rawBody: string, signature: string | null) {
  const secret = serverEnv().lineMessagingSecret
  if (!secret || !signature) return false
  return safeEqual(hmacBase64(secret, rawBody), signature)
}

export async function getLineProfile(userId: string) {
  const token = serverEnv().lineMessagingToken
  const res = await fetch(`${API}/profile/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return (await res.json()) as { displayName: string; pictureUrl?: string }
}

/**
 * Whether this LINE user has added our OA (and not blocked it): the Messaging API only returns
 * profiles of current friends. true / false, or null when LINE couldn't be asked.
 */
export async function isOaFriend(userId: string): Promise<boolean | null> {
  const token = serverEnv().lineMessagingToken
  if (!token) return null
  try {
    const res = await fetch(`${API}/profile/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) })
    if (res.ok) return true
    if (res.status === 404) return false
    return null
  } catch {
    return null
  }
}

/** Make site-relative URLs absolute (LINE requires https URLs). */
export function absoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//.test(url)) return url
  return `${env.siteUrl}${url.startsWith('/') ? '' : '/'}${url}`
}

const httpsOnly = (u?: string) => (u && u.startsWith('https://') ? u : undefined)

// ----------------------------------------------------------------- content model

export type Action =
  | { type: 'uri'; label: string; url: string }
  | { type: 'postback'; label: string; data: string; displayText?: string }
  | { type: 'message'; label: string; text: string }

export type NoticeContent = {
  altText: string
  headerBar?: string // label next to the club logo ("มีคนชวนคุณเข้าทีม")
  badge?: string // pill above the title ("ตรงกับสกิลของคุณ")
  badgeTone?: 'yellow' | 'orange' | 'red' | 'blue' | 'grey'
  person?: { name: string; sub?: string; anonymous?: boolean }
  title: string
  subtitle?: string
  quote?: string
  facts?: { label: string; value: string }[]
  bullets?: string[]
  imageUrl?: string | null
  imageAspect?: string // e.g. "20:13"
  actions: Action[] // first is primary
  size?: 'kilo' | 'mega'
}

const LOGO_ICON = () => absoluteUrl('/assets/line/icon.png')
export const WELCOME_IMAGE = () => absoluteUrl('/assets/line/welcome.png')

const TONES: Record<NonNullable<NoticeContent['badgeTone']>, { bg: string; fg: string }> = {
  yellow: { bg: YELLOW, fg: NAVY },
  orange: { bg: '#FFEDD5', fg: '#C2410C' },
  red: { bg: '#FEE2E2', fg: '#B91C1C' },
  blue: { bg: '#E8EEFB', fg: BRAND },
  grey: { bg: '#F1F5F9', fg: MUTED },
}

function toLineAction(a: Action) {
  const label = a.label.slice(0, 20)
  if (a.type === 'uri') return { type: 'uri', label, uri: absoluteUrl(a.url) }
  if (a.type === 'message') return { type: 'message', label, text: a.text.slice(0, 300) }
  return { type: 'postback', label, data: a.data, displayText: a.displayText ?? a.label }
}

const pill = (text: string, tone: NonNullable<NoticeContent['badgeTone']> = 'yellow') => ({
  type: 'box',
  layout: 'horizontal',
  contents: [
    {
      type: 'box',
      layout: 'vertical',
      backgroundColor: TONES[tone].bg,
      cornerRadius: '999px',
      paddingStart: '10px',
      paddingEnd: '10px',
      paddingTop: '3px',
      paddingBottom: '3px',
      flex: 0,
      contents: [{ type: 'text', text, size: 'xxs', weight: 'bold', color: TONES[tone].fg }],
    },
  ],
})

/** Club logo + name strip at the top of every card (with an optional label on the right). */
function brandHeader(label?: string): LineMessage {
  return {
    type: 'box',
    layout: 'horizontal',
    alignItems: 'center',
    spacing: 'sm',
    paddingTop: '12px',
    paddingBottom: '10px',
    paddingStart: '16px',
    paddingEnd: '16px',
    backgroundColor: '#FFFFFF',
    contents: [
      { type: 'image', url: LOGO_ICON(), size: '28px', aspectRatio: '1:1', aspectMode: 'fit', flex: 0 },
      { type: 'text', text: 'Mahidol Startup Club', size: 'xs', weight: 'bold', color: NAVY, flex: 1, gravity: 'center' },
      ...(label
        ? [
            {
              type: 'box',
              layout: 'vertical',
              flex: 0,
              backgroundColor: BRAND,
              cornerRadius: '999px',
              paddingStart: '10px',
              paddingEnd: '10px',
              paddingTop: '3px',
              paddingBottom: '3px',
              contents: [{ type: 'text', text: label.slice(0, 24), size: 'xxs', color: '#FFFFFF', weight: 'bold' }],
            },
          ]
        : []),
    ],
  }
}

function footerButtons(actions: Action[]): LineMessage | undefined {
  if (!actions.length) return undefined
  const [primary, ...rest] = actions.slice(0, 4)
  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    paddingAll: '14px',
    paddingTop: '4px',
    contents: [
      { type: 'button', style: 'primary', color: BRAND, height: 'md', action: toLineAction(primary) },
      ...rest.map((a) => ({ type: 'button', style: 'secondary', color: '#EEF2FA', height: 'sm', action: toLineAction(a) })),
    ],
  }
}

export function noticeBubble(c: NoticeContent): LineMessage {
  const body: LineMessage[] = []
  if (c.badge) body.push(pill(c.badge, c.badgeTone))
  if (c.person) {
    body.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'md',
      alignItems: 'center',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          width: '40px',
          height: '40px',
          cornerRadius: '20px',
          backgroundColor: c.person.anonymous ? '#E2E8F0' : NAVY,
          justifyContent: 'center',
          alignItems: 'center',
          contents: [
            {
              type: 'text',
              text: c.person.anonymous ? '?' : Array.from(c.person.name)[0] || '?',
              color: c.person.anonymous ? MUTED : '#FFFFFF',
              size: 'md',
              weight: 'bold',
              align: 'center',
            },
          ],
        },
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: c.person.name, weight: 'bold', size: 'sm', color: NAVY, wrap: true },
            ...(c.person.sub ? [{ type: 'text', text: c.person.sub, size: 'xs', color: MUTED, wrap: true }] : []),
          ],
        },
      ],
    })
  }
  body.push({ type: 'text', text: c.title, weight: 'bold', size: 'lg', color: NAVY, wrap: true, maxLines: 4 })
  if (c.subtitle) body.push({ type: 'text', text: c.subtitle, size: 'sm', color: MUTED, wrap: true })
  if (c.facts?.length) {
    body.push({
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      margin: 'md',
      contents: c.facts.slice(0, 5).map((f) => ({
        type: 'box',
        layout: 'baseline',
        spacing: 'sm',
        contents: [
          { type: 'text', text: f.label, size: 'xs', color: MUTED, flex: 2 },
          { type: 'text', text: f.value, size: 'xs', color: NAVY, weight: 'bold', flex: 5, wrap: true },
        ],
      })),
    })
  }
  if (c.bullets?.length) {
    body.push({
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      margin: 'md',
      contents: c.bullets.slice(0, 5).map((t) => ({ type: 'text', text: t, size: 'sm', color: NAVY, wrap: true })),
    })
  }
  if (c.quote) {
    body.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F3F6FC',
      cornerRadius: '10px',
      paddingAll: '10px',
      margin: 'md',
      contents: [{ type: 'text', text: `“${c.quote}”`, size: 'sm', color: NAVY, wrap: true }],
    })
  }

  const hero = httpsOnly(absoluteUrl(c.imageUrl))
  const footer = footerButtons(c.actions)
  return {
    type: 'bubble',
    size: c.size ?? 'mega',
    header: brandHeader(c.headerBar),
    ...(hero ? { hero: { type: 'image', url: hero, size: 'full', aspectRatio: c.imageAspect ?? '20:13', aspectMode: 'cover' } } : {}),
    body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px', paddingTop: hero ? '14px' : '4px', contents: body },
    ...(footer ? { footer } : {}),
    styles: { header: { separator: !hero, separatorColor: '#E5EAF3' } },
  }
}

export function noticeFlex(c: NoticeContent): LineMessage {
  return { type: 'flex', altText: c.altText.slice(0, 400), contents: noticeBubble(c) }
}

/** Carousel of event cards (search replies, "งานแข่ง"). */
export function eventsCarousel(
  altText: string,
  items: { title: string; subtitle: string; imageUrl?: string | null; url: string; badge?: string; badgeTone?: NoticeContent['badgeTone']; category?: string }[],
  moreUrl?: string,
): LineMessage {
  const bubbles = items.slice(0, 9).map((it) =>
    noticeBubble({
      altText,
      size: 'kilo',
      headerBar: it.category,
      badge: it.badge,
      badgeTone: it.badgeTone,
      title: it.title,
      subtitle: it.subtitle,
      imageUrl: it.imageUrl,
      imageAspect: '4:3',
      actions: [{ type: 'uri', label: 'ดูรายละเอียด & สมัคร', url: it.url }],
    }),
  )
  if (moreUrl) {
    bubbles.push({
      type: 'bubble',
      size: 'kilo',
      header: brandHeader(),
      body: {
        type: 'box',
        layout: 'vertical',
        justifyContent: 'center',
        spacing: 'sm',
        paddingAll: '20px',
        contents: [
          { type: 'text', text: '🔎', size: '3xl', align: 'center' },
          { type: 'text', text: 'ดูทั้งหมดบนเว็บ', weight: 'bold', size: 'lg', color: NAVY, align: 'center', wrap: true },
          { type: 'text', text: 'กรองตามประเภท วันปิดรับ และดูทีมที่กำลังหาคน', size: 'xs', color: MUTED, align: 'center', wrap: true },
        ],
      },
      footer: footerButtons([{ type: 'uri', label: 'เปิดเว็บ', url: moreUrl }]),
    })
  }
  return { type: 'flex', altText: altText.slice(0, 400), contents: { type: 'carousel', contents: bubbles } }
}

export function textMessage(text: string, quickReplies?: { label: string; text?: string; url?: string }[]): LineMessage {
  return {
    type: 'text',
    text: text.slice(0, 5000),
    ...(quickReplies?.length
      ? {
          quickReply: {
            items: quickReplies.slice(0, 13).map((q) => ({
              type: 'action',
              action: q.url
                ? { type: 'uri', label: q.label.slice(0, 20), uri: absoluteUrl(q.url) }
                : { type: 'message', label: q.label.slice(0, 20), text: q.text ?? q.label },
            })),
          },
        }
      : {}),
  }
}
