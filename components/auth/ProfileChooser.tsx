'use client'
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import type { ProfileCard } from '@/lib/profiles/core'

export function ProfileChooser({ cards, next }: { cards: ProfileCard[]; next: string | null }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function pick(kind: string) {
    setBusy(kind); setError(null)
    const res = await fetch('/api/profiles', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind }) })
    const data = await res.json().catch(() => ({})) as { home?: string; error?: string }
    setBusy(null)
    if (!res.ok) { setError(data.error ?? 'Não foi possível trocar de perfil.'); return }
    window.location.assign(next ?? data.home ?? '/')
  }
  return (
    <div className="ha-stack">
      <div className="ha-grid-cards ha-grid-cards--3">
        {cards.map((c) => (
          <button key={c.kind} type="button" className="ha-profile-card" onClick={() => pick(c.kind)} disabled={busy !== null}>
            <Icon name={c.icon} size={28} />
            <span className="ha-title">{c.name}</span>
            <span className="ha-muted ha-sm">{c.description}</span>
          </button>
        ))}
      </div>
      {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
    </div>
  )
}
