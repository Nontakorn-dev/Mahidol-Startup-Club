import Link from 'next/link'
import BackLink from './BackLink'
import { IconBack } from './icons'

/** `smart`: "ย้อนกลับ" returns to the previous page in this tab (falls back to `back`). */
export default function Crumbs({ back, trail, smart }: { back: string; trail: { label: string; href?: string }[]; smart?: boolean }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      {smart ? (
        <BackLink href={back} className="back">
          <IconBack size={18} />
          ย้อนกลับ
        </BackLink>
      ) : (
        <Link href={back} className="back">
          <IconBack size={18} />
          ย้อนกลับ
        </Link>
      )}
      <span className="trail">
        {trail.map((t, i) => (
          <span key={i} className="trail">
            {i > 0 && (
              <span aria-hidden="true" className="sep">
                /
              </span>
            )}
            {t.href ? <Link href={t.href}>{t.label}</Link> : <span className="here">{t.label}</span>}
          </span>
        ))}
      </span>
    </nav>
  )
}
