'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ds/Badge'
import { Toast } from '@/components/ds/Toast'
import { formatBRL } from '@/lib/artworks/domain'
import type { WalletItem } from '@/lib/collector-wallet/server'

export function WalletScreen({ items, totalCents, holderName, transferOn }: { items: WalletItem[]; totalCents: string; holderName: string; transferOn: boolean }) {
  const [sel, setSel] = useState(0)
  const [toast, setToast] = useState('')
  const w = items[sel]
  async function insure() {
    if (!w) return
    const res = await fetch(`/api/wallet/${w.artworkId}/insure`, { method: 'POST' })
    const data = await res.json().catch(() => ({})) as { insurer?: string; error?: string }
    setToast(res.ok ? `Cotação aceita · ${data.insurer} — apólice emitida` : data.error ?? 'Não foi possível segurar.')
    if (res.ok) window.setTimeout(() => window.location.reload(), 800)
  }
  return (
    <div className="ha-split">
      <section className="ha-stack">
        <div className="ha-eyebrow">{holderName}</div>
        <h1 className="ha-h1">Carteira de escrituras</h1>
        <div className="ha-row"><span className="ha-muted">Valor registrado · {items.length} obra(s)</span><b className="ha-num">{formatBRL(BigInt(totalCents))}</b></div>
        <ul className="ha-list">
          {items.length === 0 ? <li className="ha-muted">Nenhuma escritura ainda.</li> : null}
          {items.map((it, i) => (
            <li key={it.artworkId}>
              <button type="button" className="ha-list__row ha-list__btn" style={{ gridTemplateColumns: '40px 1fr auto auto', width: '100%', borderColor: i === sel ? 'var(--ha-ink-900)' : undefined }} onClick={() => setSel(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
                <span className="ha-wall ha-wall--40">{it.cover ? <img src={it.cover} alt="" /> : null}</span>
                <span style={{ textAlign: 'left' }}><b>{it.title}</b><br /><span className="ha-muted ha-sm">{it.artist} · adquirida em {it.acquiredAt}</span></span>
                <span className="ha-num">{it.priceLabel}</span>
                <Badge tone={it.insured ? 'verified' : 'pending'}>{it.insured ? 'Segurada' : 'Sem seguro'}</Badge>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {w ? (
        <section className="ha-deed ha-stack">
          <div className="ha-row"><span className="ha-eyebrow">HouseArt</span><span className="ha-muted ha-sm">{w.publicId}</span></div>
          <h2 className="ha-h3">Escritura da obra</h2>
          <div className="ha-kv">
            <span>Obra</span><span>{w.title}</span>
            <span>Artista</span><span>{w.artist}</span>
            <span>Titular</span><span>{w.holderName}{w.holderMask ? ` · CPF ${w.holderMask}` : ''}</span>
            <span>Desde</span><span>{w.acquiredAt}</span>
            <span>Apólice</span><span>{w.insurer ?? 'Sem apólice'}</span>
          </div>
          <p className="ha-muted ha-sm">Carimbo do tempo ICP-Brasil · {w.acquiredAt} · versão {w.version}</p>
          <div className="ha-row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => setToast('Revenda pela carteira: em breve (mercado secundário, comissão 8% + 4%).')}>Vender</button>
            {transferOn ? <Link href={`/transfer?artworkId=${w.artworkId}`} className="ha-btn ha-btn--outline ha-btn--sm">Transferir</Link> : null}
            <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" disabled={w.insured} onClick={insure}>Segurar</button>
            <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => setToast('Laudo: avaliador credenciado em até 5 dias (módulo de laudos).')}>Pedir laudo</button>
            <a className="ha-btn ha-btn--outline ha-btn--sm" href={`/verify/${w.publicId}`} target="_blank" rel="noreferrer">Compartilhar certificado</a>
          </div>
        </section>
      ) : null}
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
