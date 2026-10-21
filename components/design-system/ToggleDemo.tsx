'use client'
import { useState } from 'react'
import { Toggle } from '@/components/ds/Toggle'

export function ToggleDemo({ label }: { label: string }) {
  const [on, setOn] = useState(true)
  return (
    <div className="ha-row ha-sm" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOn(!on)}>
      <span>{label}</span>
      <Toggle on={on} onChange={setOn} label={label} />
    </div>
  )
}
