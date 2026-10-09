// Hand-drawn duotone illustrations for the two "ลงประกาศ" cards (light theme):
// navy outlines, pale-blue fills, one small gold accent. 64×64, scales cleanly.

const NAVY = '#0A2558'
const BLUE = '#2F5FD0'
const PALE = '#DCE7FB'
const PALER = '#EEF3FD'
const GOLD = '#E3A817'

/** Two teammates + a small trophy badge — "หาทีมแข่ง". */
export function TeamIllustration({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* back teammate */}
      <circle cx="40" cy="17" r="6.5" fill={PALER} stroke={BLUE} strokeWidth="2" />
      <path d="M29 39c1.1-6.6 5.4-10.4 11-10.4s9.9 3.8 11 10.4" fill={PALER} stroke={BLUE} strokeWidth="2" strokeLinecap="round" />
      {/* front teammate */}
      <circle cx="23" cy="24" r="7.8" fill={PALE} stroke={NAVY} strokeWidth="2.2" />
      <path d="M9.5 51c1.4-8.6 6.6-13.4 13.5-13.4S35.1 42.4 36.5 51" fill={PALE} stroke={NAVY} strokeWidth="2.2" strokeLinecap="round" />
      {/* trophy badge */}
      <circle cx="48" cy="48" r="9.5" fill="#fff" stroke={GOLD} strokeWidth="2" />
      <path d="M44.2 43.6h7.6v2.5a3.8 3.8 0 0 1-7.6 0v-2.5Z" fill="#FFF3D1" stroke={GOLD} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M44.2 44.5h-1.5a1.5 1.5 0 0 0 1.7 2.3M51.8 44.5h1.5a1.5 1.5 0 0 1-1.7 2.3M48 50v2.2M45.6 52.8h4.8" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** A lit idea with a "+1 person" badge — "หา Co-Founder". */
export function CofounderIllustration({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* rays */}
      <path d="M28 6v4M12.5 12.5l2.8 2.8M43.5 12.5l-2.8 2.8M7 27h4M45 27h4" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
      {/* bulb */}
      <path d="M28 14c-7.2 0-12.5 5.3-12.5 12.2 0 4.4 2.2 7.6 4.9 10 1.4 1.3 2.1 2.9 2.1 4.6V43h11v-2.2c0-1.7.7-3.3 2.1-4.6 2.7-2.4 4.9-5.6 4.9-10C40.5 19.3 35.2 14 28 14Z" fill={PALE} stroke={NAVY} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M23.5 47.5h9M25 52h6" stroke={NAVY} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 26.5c0-2.5 1.8-4.5 4-4.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      {/* +1 person badge */}
      <circle cx="47" cy="45" r="11" fill="#fff" stroke={BLUE} strokeWidth="2" />
      <circle cx="45" cy="42" r="3.2" fill={PALER} stroke={BLUE} strokeWidth="1.8" />
      <path d="M39.6 51.2c.8-3.3 2.8-5 5.4-5s4.6 1.7 5.4 5" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M52 39.5v5M49.5 42h5" stroke={GOLD} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}
