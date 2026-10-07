'use client'
import { useState, useTransition } from 'react'
import { toggleFeatured } from '@/app/actions/admin'
import { IconStar } from '../icons'

export default function FeaturedStar({ id, initial }: { id: string; initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      className="star-btn"
      aria-pressed={on}
      aria-label="แสดงบนหน้าแรก"
      title={on ? 'เอาออกจากหน้าแรก' : 'แสดงบนหน้าแรก'}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await toggleFeatured(id)
          if (res.error) alert(res.error)
          else if (typeof res.featured === 'boolean') setOn(res.featured)
        })
      }
    >
      <IconStar size={22} filled={on} />
    </button>
  )
}
