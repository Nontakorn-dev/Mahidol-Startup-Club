/* eslint-disable @next/next/no-img-element */
import { IconUser } from './icons'

type Props = {
  name?: string | null
  initial?: string
  src?: string | null
  anonymous?: boolean
  size?: number
  brand?: boolean
  className?: string
  fontSize?: number
}

export default function Avatar({ name, initial, src, anonymous, size = 60, brand, className = '', fontSize }: Props) {
  const style = { width: size, height: size, fontSize: fontSize ?? Math.round(size * 0.37) }
  if (anonymous) {
    return (
      <span className={`avatar anon ${className}`} style={style}>
        <IconUser size={Math.round(size * 0.47)} />
      </span>
    )
  }
  if (src) {
    return (
      <span className={`avatar ${className}`} style={style}>
        {/* Google profile photos refuse requests that carry a Referer */}
        <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
      </span>
    )
  }
  const ch = initial || (name ? Array.from(name.trim())[0] : '?')
  return (
    <span className={`avatar ${brand ? 'brand' : ''} ${className}`} style={style}>
      {ch}
    </span>
  )
}
