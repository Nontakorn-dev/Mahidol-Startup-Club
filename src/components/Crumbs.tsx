import Link from 'next/link'
import { IconBack } from './icons'

export default function Crumbs({ back, trail }: { back: string; trail: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      <Link href={back} className="back">
        <IconBack size={18} />
        ย้อนกลับ
      </Link>
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
