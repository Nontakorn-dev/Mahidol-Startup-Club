'use client'
import { useState } from 'react'

type Option = { value: string; label: string }

/** Pill multi-select (aria-pressed), or single-select radio group when `single`. Writes hidden inputs. */
export default function ChipSelect({
  name,
  options,
  defaultValue = [],
  single,
  label,
}: {
  name: string
  options: Option[]
  defaultValue?: string[]
  single?: boolean
  label: string
}) {
  const [value, setValue] = useState<string[]>(defaultValue)
  const toggle = (v: string) => {
    if (single) setValue([v])
    else setValue((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))
  }
  return (
    <div role={single ? 'radiogroup' : 'group'} aria-label={label} className="chip-group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="toggle-chip"
          {...(single ? { role: 'radio', 'aria-checked': value.includes(o.value) } : { 'aria-pressed': value.includes(o.value) })}
          onClick={() => toggle(o.value)}
        >
          {o.label}
        </button>
      ))}
      {value.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </div>
  )
}
