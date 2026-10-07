// Stroke icons lifted from the design export (24×24, currentColor).
import type { ReactNode } from 'react'

type P = { size?: number; strokeWidth?: number; className?: string }

function Svg({ size = 20, strokeWidth = 2, className, children }: P & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

export const IconArrowRight = (p: P) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </Svg>
)
export const IconBack = (p: P) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
)
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
)
export const IconChevronDown = (p: P) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
)
export const IconTrophy = (p: P) => (
  <Svg strokeWidth={1.9} {...p}>
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3" />
    <path d="M7 5H4v2a3 3 0 0 0 3 3" />
  </Svg>
)
export const IconPeople = (p: P) => (
  <Svg strokeWidth={1.9} {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M16 14.2a5 5 0 0 1 5.5 5.8" />
  </Svg>
)
export const IconUserPlus = (p: P) => (
  <Svg strokeWidth={1.9} {...p}>
    <circle cx="10" cy="8" r="4" />
    <path d="M3 21a7 7 0 0 1 14 0" />
    <path d="M19 8v6" />
    <path d="M16 11h6" />
  </Svg>
)
export const IconUser = (p: P) => (
  <Svg strokeWidth={1.8} {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
)
export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
)
export const IconChat = (p: P) => (
  <Svg strokeWidth={1.8} {...p}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    <path d="M8.5 11h7" />
    <path d="M8.5 14.5h4" />
  </Svg>
)
export const IconChatSimple = (p: P) => (
  <Svg {...p}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </Svg>
)
export const IconLine = (p: P) => (
  <Svg {...p}>
    <path d="M21 11.5c0 4.1-4 7.5-9 7.5-.9 0-1.8-.1-2.6-.3L5 21l.9-3.6C4.1 16 3 13.9 3 11.5 3 7.4 7 4 12 4s9 3.4 9 7.5z" />
  </Svg>
)
export const IconCalendar = (p: P) => (
  <Svg strokeWidth={1.9} {...p}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
  </Svg>
)
export const IconHome = (p: P) => (
  <Svg strokeWidth={1.9} {...p}>
    <path d="M4 21V8l8-5 8 5v13" />
    <path d="M9 21v-6h6v6" />
  </Svg>
)
export const IconPin = (p: P) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M9 4h6l-1 6 4 4H6l4-4z" />
    <path d="M12 14v7" />
  </Svg>
)
export const IconMoney = (p: P) => (
  <Svg strokeWidth={1.9} {...p}>
    <path d="M3 7h18v10H3z" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M7 7v10M17 7v10" />
  </Svg>
)
export const IconBuilding = (p: P) => (
  <Svg strokeWidth={1.9} {...p}>
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <path d="M9 10h1M14 10h1M9 14h1M14 14h1" />
  </Svg>
)
export const IconExternal = (p: P) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M18 14v6H4V6h6" />
  </Svg>
)
export const IconBookmark = (p: P & { filled?: boolean }) => (
  <svg
    width={p.size ?? 18}
    height={p.size ?? 18}
    viewBox="0 0 24 24"
    fill={p.filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 3h12v18l-6-4-6 4z" />
  </svg>
)
export const IconShare = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v12" />
    <path d="M7 8l5-5 5 5" />
    <path d="M5 14v5h14v-5" />
  </Svg>
)
export const IconPlus = (p: P) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Svg>
)
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </Svg>
)
export const IconCheck = (p: P) => (
  <Svg strokeWidth={2.4} {...p}>
    <path d="M5 12l4 4 10-10" />
  </Svg>
)
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8h.01" />
    <path d="M11 12h1v4h1" />
  </Svg>
)
export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
    <path d="M10.3 20a2 2 0 0 0 3.4 0" />
  </Svg>
)
export const IconQr = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3z" />
    <path d="M20 14v7h-6" />
  </Svg>
)
export const IconShield = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
  </Svg>
)
export const IconVerified = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l2.5 2 3.2-.3.8 3.1 2.7 1.8-1.3 2.9 1.3 2.9-2.7 1.8-.8 3.1-3.2-.3L12 21l-2.5-2-3.2.3-.8-3.1-2.7-1.8L4.1 12 2.8 9.1l2.7-1.8.8-3.1 3.2.3z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
)
export const IconEye = (p: P) => (
  <Svg {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)
export const IconEdit = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </Svg>
)
export const IconImage = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 17l-5-5-9 8" />
  </Svg>
)
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
)
export const IconStar = (p: P & { filled?: boolean }) => (
  <svg
    width={p.size ?? 20}
    height={p.size ?? 20}
    viewBox="0 0 24 24"
    fill={p.filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
  </svg>
)
export const IconLink = (p: P) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
)
export const IconFile = (p: P) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
)
export const IconDashboard = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Svg>
)
export const IconMegaphone = (p: P) => (
  <Svg {...p}>
    <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z" />
    <path d="M16 8a5 5 0 0 1 0 8" />
    <path d="M19 5a9 9 0 0 1 0 14" />
  </Svg>
)
export const IconPaperclip = (p: P) => (
  <Svg {...p}>
    <path d="M21 12.5l-8.5 8.5a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.3-8.3" />
  </Svg>
)
export const IconSparkle = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </Svg>
)
export const IconLogout = (p: P) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
)
export const IconSettings = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
)
export const IconSend = IconArrowRight
