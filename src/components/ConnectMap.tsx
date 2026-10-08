import Image from 'next/image'
import type { ReactNode } from 'react'
import { IconChat, IconCheck, IconFile, IconPeople } from '@/components/icons'

// Phone/tablet version of the hero "MSC Connect" artwork: "คุณ" at the bottom centre with the
// five people fanned out above it. Laid out on a 340×232 grid and scaled with container units,
// so it keeps the same proportions from a small phone up to a portrait iPad.
// Avatars are cut from hero-connect.png by scripts/connect-avatars.mjs.

const W = 340
const H = 232
const CX = 170
const CY = 166
const RX = 132
const RY = 118
const HUB = 76 // diameter of "คุณ" (avatars are 56; sizes mirrored in globals.css)

type Tone = 'blue' | 'gold'
type Node = { key: string; label: string; deg: number; tone: Tone; icon?: ReactNode }
const NODES: Node[] = [
  { key: 'partner', label: 'Partner', deg: 180, tone: 'blue', icon: <IconFile size={11} /> },
  { key: 'team', label: 'เพื่อนร่วมทีม', deg: 135, tone: 'blue', icon: <IconChat size={11} /> },
  { key: 'mentor', label: 'Mentor', deg: 90, tone: 'gold', icon: <IconCheck size={11} /> },
  { key: 'startup', label: 'Startup', deg: 45, tone: 'gold' },
  { key: 'investor', label: 'นักลงทุน', deg: 0, tone: 'gold', icon: <IconPeople size={11} /> },
]

const pct = (v: number, of: number) => `${(v / of) * 100}%`

/** `dark`: for navy backgrounds (login brand panel) — light lines, white hub. */
export default function ConnectMap({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  const nodes = NODES.map((n) => {
    const a = (n.deg * Math.PI) / 180
    const x = CX + RX * Math.cos(a)
    const y = CY - RY * Math.sin(a)
    // Badge just outside "คุณ", clear of the avatar's label.
    const len = Math.hypot(x - CX, y - CY)
    const t = (HUB / 2 + 14) / len
    return { ...n, x, y, bx: CX + (x - CX) * t, by: CY + (y - CY) * t }
  })

  return (
    <div className={`connect-map ${dark ? 'cm-dark' : ''} ${className}`} role="img" aria-label="MSC Connect: คุณเชื่อมกับเพื่อนร่วมทีม Mentor Startup Partner และนักลงทุน">
      <div className="cm-stage" aria-hidden="true">
        <svg className="cm-lines" viewBox={`0 0 ${W} ${H}`}>
          <ellipse cx={CX} cy={CY} rx={RX} ry={RY} className="cm-orbit" />
          <ellipse cx={CX} cy={CY} rx={RX * 0.62} ry={RY * 0.62} className="cm-orbit" />
          {nodes.map((n) => (
            <line key={n.key} x1={CX} y1={CY} x2={n.x} y2={n.y} className={`cm-line ${n.tone}`} strokeWidth={2} strokeLinecap="round" />
          ))}
        </svg>
        {nodes.map(
          (n) =>
            n.icon && (
              <span key={`b-${n.key}`} className={`cm-badge ${n.tone}`} style={{ left: pct(n.bx, W), top: pct(n.by, H) }}>
                {n.icon}
              </span>
            ),
        )}
        <span className="cm-hub" style={{ left: pct(CX, W), top: pct(CY, H) }}>
          <span className="cm-pulse" />
          <IconPeople size={22} />
          <b>คุณ</b>
        </span>
        <span className="cm-brand" style={{ left: pct(CX, W), top: pct(CY + HUB / 2 + 14, H) }}>
          MSC CONNECT
        </span>
        {nodes.map((n) => (
          <span key={n.key} className={`cm-node ${n.tone}`} style={{ left: pct(n.x, W), top: pct(n.y, H) }}>
            <Image src={`/assets/connect/${n.key}.webp`} alt="" width={192} height={192} sizes="96px" />
            <span className="cm-label">{n.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
