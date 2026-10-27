'use client'
// Perfil › Segurança › Aparelhos conectados: the live sessions, this device first,
// "Sair" on each other one and "Sair de todos os outros" below.
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import type { DeviceView } from '@/lib/auth/devices-core'

export function DevicesList({ initial }: { initial: DeviceView[] }) {
  const [devices, setDevices] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const others = devices.filter((d) => !d.current)

  async function out(id: number) {
    setBusy(String(id)); setMsg(null)
    try {
      const r = await fetch(`/api/account/devices/${id}`, { method: 'DELETE' })
      const d = await r.json().catch(() => ({})) as { error?: string }
      if (!r.ok && r.status !== 404) { setMsg(d.error ?? 'Não foi possível encerrar a sessão.'); return }
      setDevices((list) => list.filter((x) => x.id !== id))
      setMsg('Sessão encerrada nesse aparelho.')
    } finally { setBusy(null) }
  }

  async function outAll() {
    if (!window.confirm('Sair de todos os outros aparelhos? Eles vão pedir login de novo.')) return
    setBusy('all'); setMsg(null)
    try {
      const r = await fetch('/api/account/devices/others', { method: 'POST' })
      const d = await r.json().catch(() => ({})) as { error?: string; count?: number }
      if (!r.ok) { setMsg(d.error ?? 'Não foi possível encerrar as sessões.'); return }
      setDevices((list) => list.filter((x) => x.current))
      setMsg(d.count ? `${d.count === 1 ? '1 aparelho desconectado' : `${d.count} aparelhos desconectados`}.` : 'Nenhum outro aparelho conectado.')
    } finally { setBusy(null) }
  }

  return (
    <>
      <ul className="ha-devices">
        {devices.map((d) => (
          <li key={d.id} className="ha-device">
            <Icon name={d.icon} size={24} />
            <span className="ha-stack">
              <span className="ha-device__n">{d.label}</span>
              <span className="ha-device__k">{[d.when, d.where].filter(Boolean).join(' · ')}</span>
            </span>
            {d.current ? <span className="ha-device__here">Este aparelho</span> : <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" disabled={busy !== null} aria-busy={busy === String(d.id) || undefined} onClick={() => out(d.id)}>{busy === String(d.id) ? 'Saindo' : 'Sair'}</button>}
          </li>
        ))}
      </ul>
      {others.length ? <button type="button" className="ha-btn ha-btn--ink ha-btn--md ha-devices__all" disabled={busy !== null} aria-busy={busy === 'all' || undefined} onClick={outAll}>{busy === 'all' ? 'Saindo' : 'Sair de todos os outros aparelhos'}</button> : <p className="ha-sm ha-muted">Nenhum outro aparelho conectado à sua conta.</p>}
      {msg ? <p className="ha-sm" role="status">{msg}</p> : null}
    </>
  )
}
