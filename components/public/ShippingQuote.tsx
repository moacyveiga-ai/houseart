'use client'
// "Frete e seguro" of the price box: the viewer types a CEP, the pure core
// quotes the three carriers (estimate until checkout), the transit insurance
// toggles and the total follows.
import { useState } from 'react'
import { Toggle } from '@/components/ds/Toggle'
import { formatBRL } from '@/lib/artworks/domain'
import { cheapest, formatCep, insuranceCents, normalizeCep, quoteShipping, ufFromCep, type ArtworkSize, type CarrierKey } from '@/lib/shipping/quote-core'

export function ShippingQuote({ fromUf, size, priceCents }: { fromUf: string | null; size: ArtworkSize; priceCents: number | null }) {
  const [cep, setCep] = useState<string | null>(null)
  const [editing, setEditing] = useState(true)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [carrier, setCarrier] = useState<CarrierKey | null>(null)
  const [insured, setInsured] = useState(true)
  const uf = cep ? ufFromCep(cep) : null
  const quotes = quoteShipping({ fromUf, toUf: uf, size })
  const chosen = quotes ? quotes.find((q) => q.carrier === carrier) ?? cheapest(quotes) : null
  const insurance = priceCents !== null ? insuranceCents(priceCents) : null
  const total = priceCents !== null && chosen ? priceCents + chosen.priceCents + (insured && insurance ? insurance : 0) : null

  function apply(e: React.FormEvent) {
    e.preventDefault()
    const n = normalizeCep(draft)
    if (!n || !ufFromCep(n)) { setError('Informe um CEP válido (8 dígitos).'); return }
    setError(null); setCep(n); setEditing(false); setCarrier(null)
  }

  return (
    <div className="hp-artwork__ship">
      <div className="hp-artwork__ship-head">
        <b>Frete e seguro</b>
        {cep && !editing ? <span className="hp-artwork__ship-cep">CEP {formatCep(cep)} · <button type="button" onClick={() => { setDraft(formatCep(cep)); setEditing(true) }}>alterar</button></span> : null}
      </div>
      {editing || !quotes ? (
        <form className="hp-artwork__ship-form" onSubmit={apply}>
          <label className="ha-label">CEP de entrega<input className="ha-input" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={draft} onChange={(e) => setDraft(e.target.value)} aria-invalid={error ? true : undefined} /></label>
          <button type="submit" className="ha-btn ha-btn--outline ha-btn--sm">Calcular</button>
        </form>
      ) : null}
      {error ? <span className="ha-field-error" role="alert">{error}</span> : null}
      {quotes && !editing ? (
        <>
          <div role="radiogroup" aria-label="Transportadora" style={{ display: 'contents' }}>
            {quotes.map((q) => (
              <button key={q.carrier} type="button" role="radio" aria-checked={chosen?.carrier === q.carrier} className="hp-artwork__carrier" onClick={() => setCarrier(q.carrier)}>
                <span className="hp-artwork__radio" />
                <span><span className="hp-artwork__carrier-name">{q.name}</span> <span className="hp-artwork__carrier-days">· {q.days} dias úteis</span></span>
                <span className="hp-artwork__carrier-price">{formatBRL(q.priceCents)}</span>
              </button>
            ))}
          </div>
          {insurance !== null ? (
            <div className="hp-artwork__insure">
              <span>Seguro de trânsito <span>· {formatBRL(insurance)}</span></span>
              <Toggle on={insured} onChange={setInsured} label="Seguro de trânsito" />
            </div>
          ) : null}
          {total !== null ? <div className="hp-artwork__total"><span>Total</span><span>{formatBRL(total)}</span></div> : null}
          <span className="hp-artwork__estimate">Frete e seguro são estimativas por CEP e tamanho da obra; o valor final é confirmado no checkout.</span>
        </>
      ) : (
        <span className="hp-artwork__estimate">Informe o CEP para estimar frete e seguro; o valor final é confirmado no checkout.</span>
      )}
    </div>
  )
}
