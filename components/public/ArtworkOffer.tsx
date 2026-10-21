'use client'
// "Comprar a preço fixo" / "Fazer oferta": both open the existing OfferForm
// (POST /api/public/offers + OTP) in a sheet below the buttons — the fixed
// purchase is the form with the list price filled in and locked.
import { useState } from 'react'
import { Button } from '@/components/ds/Button'
import { OfferForm } from '@/components/marketplace/OfferForm'

export function ArtworkOffer({ publicId, priceCents, fixedOnly }: { publicId: string; priceCents: string; fixedOnly: boolean }) {
  const [mode, setMode] = useState<'buy' | 'offer' | null>(null)
  return (
    <div className="hp-artwork__buy">
      <Button variant="primary" size="md" onClick={() => setMode('buy')} aria-expanded={mode === 'buy'}>Comprar a preço fixo</Button>
      {fixedOnly ? null : <Button variant="outline" size="md" onClick={() => setMode('offer')} aria-expanded={mode === 'offer'}>Fazer oferta</Button>}
      {mode ? (
        <div className="hp-artwork__form" role="region" aria-label={mode === 'buy' ? 'Comprar a preço fixo' : 'Fazer oferta'}>
          <div className="hp-artwork__form-head">
            <b>{mode === 'buy' ? 'Comprar a preço fixo' : 'Fazer oferta'}</b>
            <button type="button" className="ha-link" onClick={() => setMode(null)}>Fechar</button>
          </div>
          <OfferForm key={mode} publicId={publicId} fixedPriceCents={mode === 'buy' ? priceCents : null} />
        </div>
      ) : null}
    </div>
  )
}
