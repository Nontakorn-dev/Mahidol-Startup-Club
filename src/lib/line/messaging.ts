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

export type NoticeContent = {
  altText: string
  headerBar?: string // blue strip at the top ("มีคนชวนคุณเข้าทีม")
  badge?: string // yellow pill ("ตรงกับสกิลของคุณ")
  person?: { name: string; sub?: string; anonymous?: boolean }
  title: string
  subtitle?: string
  quote?: string
  imageUrl?: string | null
  actions: Action[] // first is primary
}

function toLineAction(a: Action) {
  if (a.type === 'uri') return { type: 'uri', label: a.label.slice(0, 20), uri: absoluteUrl(a.url) }
  return { type: 'postback', label: a.label.slice(0, 20), data: a.data, displayText: a.displayText ?? a.label }
}

export function noticeFlex(c: NoticeContent): LineMessage {
  const body: LineMessage[] = []
  if (c.badge) {
    body.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: YELLOW,
          cornerRadius: '999px',
          paddingStart: '10px',
          paddingEnd: '10px',
          paddingTop: '2px',
          paddingBottom: '2px',
          flex: 0,
          contents: [{ type: 'text', text: c.badge, size: 'xxs', weight: 'bold', color: NAVY }],
        },
      ],
    })
  }
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
          width: '36px',
          height: '36px',
          cornerRadius: '18px',
          backgroundColor: c.person.anonymous ? '#E2E8F0' : '#0A2558',
          justifyContent: 'center',
          alignItems: 'center',
          contents: [
            {
              type: 'text',
              text: c.person.anonymous ? '?' : Array.from(c.person.name)[0] || '?',
              color: c.person.anonymous ? MUTED : '#FFFFFF',
              size: 'sm',
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
  body.push({ type: 'text', text: c.title, weight: 'bold', size: 'md', color: NAVY, wrap: true })
  if (c.subtitle) body.push({ type: 'text', text: c.subtitle, size: 'xs', color: MUTED, wrap: true })
  if (c.quote) body.push({ type: 'text', text: `“${c.quote}”`, size: 'xs', color: NAVY, wrap: true })

  const [primary, ...rest] = c.actions
  const footer = c.actions.length
    ? {
        type: 'box',
        layout: rest.length ? 'horizontal' : 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'button', style: 'primary', color: BRAND, height: 'sm', action: toLineAction(primary) },
          ...rest.map((a) => ({ type: 'button', style: 'link', color: MUTED, height: 'sm', action: toLineAction(a) })),
        ],
      }
    : undefined

  const hero = httpsOnly(absoluteUrl(c.imageUrl))
  const bubble: LineMessage = {
    type: 'bubble',
    size: 'kilo',
    ...(c.headerBar
      ? {
          header: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: BRAND,
            paddingAll: '12px',
            contents: [{ type: 'text', text: c.headerBar, color: '#FFFFFF', size: 'sm', weight: 'bold' }],
          },
        }
      : {}),
    ...(hero ? { hero: { type: 'image', url: hero, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' } } : {}),
    body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px', contents: body },
    ...(footer ? { footer } : {}),
  }
  return { type: 'flex', altText: c.altText.slice(0, 400), contents: bubble }
}

/** Carousel of event cards for AI search replies inside LINE. */
export function eventsCarousel(
  altText: string,
  items: { title: string; subtitle: string; imageUrl?: string | null; url: string; badge?: string }[],
  moreUrl?: string,
): LineMessage {
  const bubbles = items.slice(0, 9).map((it) =>
    (noticeFlex({
      altText,
      badge: it.badge,
      title: it.title,
      subtitle: it.subtitle,
      imageUrl: it.imageUrl,
      actions: [{ type: 'uri', label: 'ดูรายละเอียด', url: it.url }],
    }).contents) as LineMessage,
  )
  if (moreUrl) {
    bubbles.push({
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        justifyContent: 'center',
        paddingAll: '20px',
        contents: [
          { type: 'text', text: 'ดูผลทั้งหมดบนเว็บ', weight: 'bold', color: NAVY, align: 'center', wrap: true },
          { type: 'text', text: 'งานแข่ง · ทีม · คน', size: 'xs', color: MUTED, align: 'center' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'button', style: 'primary', color: BRAND, height: 'sm', action: { type: 'uri', label: 'เปิดเว็บ', uri: absoluteUrl(moreUrl) } }],
      },
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
