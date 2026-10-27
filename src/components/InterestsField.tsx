'use client'
import { useRef, useState } from 'react'
import ChipSelect from './ChipSelect'
import { ROLES, ROLE_KEYS } from '@/lib/constants'

/** "อยากได้ยินเรื่องงานสายไหน" chips; picking Domain expert asks which field. */
export default function InterestsField({ interests, domain, help }: { interests: string[]; domain: string | null; help?: string }) {
  const [expert, setExpert] = useState(interests.includes('domain_expert'))
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="field interests-field">
      <span className="label">อยากได้ยินเรื่องงานสายไหน</span>
      <ChipSelect
        name="interests"
        label="สายที่สนใจ"
        options={ROLE_KEYS.map((k) => ({ value: k, label: ROLES[k] }))}
        defaultValue={interests}
        onChange={(v) => {
          const on = v.includes('domain_expert')
          if (on && !expert) requestAnimationFrame(() => input.current?.focus())
          setExpert(on)
        }}
      />
      {help && <p className="help">{help}</p>}
      {expert && (
        <div className="field domain-field">
          <label htmlFor="dx">เชี่ยวชาญด้านไหน</label>
          <input ref={input} id="dx" name="domain_expertise" className="input" maxLength={60} defaultValue={domain ?? ''} placeholder="เช่น การแพทย์, กฎหมาย, เกษตร" />
        </div>
      )}
    </div>
  )
}
