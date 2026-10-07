'use client'

type Props = {
  checked: boolean
  onChange?: (v: boolean) => void
  label: string
  name?: string
  disabled?: boolean
}

/** Design switch (blue when on). Renders a hidden input when `name` is given so it works in forms. */
export default function Switch({ checked, onChange, label, name, disabled }: Props) {
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="switch"
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
      >
        <span className="track">
          <span className="knob" />
        </span>
      </button>
      {name && <input type="hidden" name={name} value={checked ? 'on' : ''} />}
    </>
  )
}
