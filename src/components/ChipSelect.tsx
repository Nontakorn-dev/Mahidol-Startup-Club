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
  onChange,
}: {
  name: string
  options: Option[]
  defaultValue?: string[]
  single?: boolean
  label: string
  onChange?: (value: string[]) => void
}) {
  const [value, setValue] = useState<string[]>(defaultValue)
  const toggle = (v: string) => {
    const next = single ? [v] : value.includes(v) ? value.filter((x) => x !== v) : [...value, v]
    setValue(next)
    onChange?.(next)
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
