'use client'
// Toggle 44×24 of the handoff: ink-900 on, ink-300 off, knob 18px at 3/23.
export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (next: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`ha-toggle${on ? ' ha-toggle--on' : ''}`} onClick={() => onChange(!on)} />
  )
}
