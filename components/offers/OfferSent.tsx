'use client'
// The "Enviada" step of the handoff (HouseArt Oferta): the status card, the
// seller's counter with Aceitar · Fazer nova oferta · Recusar, the timeline
// and the final actions. The rules are in offer-status-core.ts; the calls go
// to the existing /reply and /retract routes (token from the e-mail link, or
// the logged buyer's session).
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Button, ButtonLink } from '@/components/ds/Button'
import { Field } from '@/components/ds/Field'
import { Modal } from '@/components/ds/Modal'
import { formatBRL } from '@/lib/artworks/domain'
import { OfferAside, type OfferArtwork } from './OfferFrame'
import { TalkToSellerButton } from '@/components/public/TalkToSellerButton'
import { finalActions, responseOf, sellerPhrase, statusCard, timelineOf, type StatusOffer } from './offer-status-core'

interface Props { code: string; offer: StatusOffer; artwork: OfferArtwork; token: string | null; deliveryCep: string | null; /** "Conversar antes": the artwork id when the buyer is signed in (never on the e-mail token link) */ talkArtworkId?: number | null }

export function OfferSent({ code, offer, artwork, token, deliveryCep, talkArtworkId = null }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countering, setCountering] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  // the DS confirmation in place of window.confirm (audit público, Oferta): recusar a contraproposta or cancel the offer
  const [confirming, setConfirming] = useState<null | { title: string; text: string; cta: string; key: 'refuse' | 'retract' }>(null)
  const r = responseOf(offer)
  const seller = artwork.seller
  const card = statusCard(offer, r, sellerPhrase(seller))
  const timeline = timelineOf(offer, r, seller)
  const actions = finalActions(offer, r, artwork.publicId)
  const closed = r === 'aceita' || r === 'contra_aceita'
  const lastSellerNote = [...offer.rounds].reverse().find((x) => x.author !== 'BUYER')?.message ?? null
  const shippingIncluded = closed && lastSellerNote !== null && /frete inclus/i.test(lastSellerNote)
  // The aside's "Sua oferta": the closed amount, or the buyer's last number while the seller's counter is on the table.
  const buyerCents = closed ? offer.currentCents : [...offer.rounds].reverse().find((x) => x.author === 'BUYER')?.amountCents ?? offer.offeredCents

  async function post(path: 'reply' | 'retract', body: Record<string, unknown>, label: string) {
    if (busy) return
    setBusy(label); setError(null)
    const res = await fetch(`/api/public/offers/${code}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...(token ? { token } : {}), ...body }) })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) { setBusy(null); setError(data.error ?? 'Não foi possível registrar. Atualize a página e tente de novo.'); return }
    window.location.reload()
  }
  const counterCents = Math.round(Number(amount.replace(/\D/g, '')) * 100)
  const counterValid = counterCents > 0 && counterCents < (offer.counterCents ?? Infinity) && counterCents <= artwork.priceCents

  return (
    <div className="hp-offer" data-screen-label="Oferta enviada">
      <main className="hp-offer__main">
        <section className="hp-offer__section">
          <div className="hp-offer__status">
            <span className={`hp-offer__status-icon hp-offer__status-icon--${card.tone}`}><Icon name={card.icon} size={30} filled /></span>
            <h1 className="hp-offer__title">{card.title}</h1>
            <span className="hp-offer__status-text">{card.text}</span>
            <span className="ha-caption">Oferta {code}{r === 'analise' || r === 'aguardando' || r === 'contra' ? ` · válida até ${new Date(offer.expiresAt).toLocaleString('pt-BR', { timeZone: 'America/Bahia', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}</span>
          </div>

          {r === 'contra' && offer.counterCents !== null ? (
            <div className="hp-offer__counter" role="region" aria-label="Contraproposta">
              <div className="hp-offer__counter-head"><span>Contraproposta {seller.kind === 'GALLERY' ? `da ${seller.name}` : 'do vendedor'}</span><b>{formatBRL(offer.counterCents)}</b></div>
              {offer.counterMessage ? <span className="hp-offer__counter-quote">“{offer.counterMessage}”</span> : null}
              {countering ? (
                <form className="hp-offer__counter-form" onSubmit={(e) => { e.preventDefault(); if (counterValid) void post('reply', { accept: false, amountCents: counterCents, message: note.trim() || undefined }, 'counter') }}>
                  <Field label="Sua nova oferta (R$)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} hint={`Entre ${formatBRL(offer.offeredCents)} e ${formatBRL(offer.counterCents)}`} />
                  <Field label="Mensagem (opcional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                  <Button variant="ink" size="sm" type="submit" loading={busy === 'counter'} disabled={!counterValid}>Enviar nova oferta</Button>
                  <Button variant="ghost" size="sm" onClick={() => setCountering(false)}>Cancelar</Button>
                </form>
              ) : (
                <div className="hp-offer__counter-actions">
                  <Button variant="primary" size="md" loading={busy === 'accept'} onClick={() => void post('reply', { accept: true }, 'accept')}>Aceitar {formatBRL(offer.counterCents)}</Button>
                  <Button variant="outline" size="md" onClick={() => setCountering(true)}>Fazer nova oferta</Button>
                  {talkArtworkId ? <TalkToSellerButton artworkId={talkArtworkId} publicId={artwork.publicId} signedIn label="Conversar antes" className="ha-btn ha-btn--outline ha-btn--md" /> : null}
                  {offer.canRetract ? <button type="button" className="hp-offer__edit" disabled={busy === 'refuse'} onClick={() => setConfirming({ title: 'Recusar a contraproposta?', text: 'Recusar a contraproposta retira a sua oferta e desfaz a reserva da garantia.', cta: 'Recusar', key: 'refuse' })}>Recusar</button> : null}
                </div>
              )}
            </div>
          ) : null}

          {error ? <p className="hp-offer__error" role="alert">{error}</p> : null}

          <ol className="hp-offer__timeline" aria-label="Andamento da oferta">
            {timeline.map((t) => (
              <li key={t.name} className={`hp-offer__tl${t.done ? ' hp-offer__tl--done' : ''}`}>
                <span className="hp-offer__tl-rail"><span className="hp-offer__tl-line" /><span className="hp-offer__tl-dot">{t.done ? <Icon name="check" size={14} /> : null}</span></span>
                <div className="hp-offer__tl-body"><b>{t.name}</b><span>{t.sub}</span></div>
                <span className="hp-offer__tl-when">{t.when}</span>
              </li>
            ))}
          </ol>

          <div className="hp-offer__final">
            {actions.map((a) => a.href
              ? <ButtonLink key={a.name} href={a.href} variant={a.kind} size="md">{a.name}</ButtonLink>
              : <Button key={a.name} variant={a.kind} size="md" loading={busy === 'retract'} onClick={() => setConfirming({ title: 'Cancelar a oferta?', text: 'A reserva da garantia é desfeita na hora.', cta: 'Cancelar a oferta', key: 'retract' })}>{a.name}</Button>)}
          </div>
        </section>
      </main>
      <Modal open={!!confirming} title={confirming?.title ?? ''} onClose={() => setConfirming(null)} footer={confirming ? (
        <div className="ha-row" style={{ gap: 8 }}>
          <Button variant="outline" size="md" onClick={() => setConfirming(null)}>Voltar</Button>
          <Button variant="danger" size="md" onClick={() => { const k = confirming.key; setConfirming(null); void post('retract', {}, k) }}>{confirming.cta}</Button>
        </div>
      ) : null}>
        <p className="ha-sm">{confirming?.text}</p>
      </Modal>
      <OfferAside artwork={artwork} summary={{ offerCents: buyerCents, shippingCents: offer.shippingCents, insuranceCents: offer.insuranceCents, shippingIncluded, destination: deliveryCep ? `o CEP ${deliveryCep}` : null }} />
    </div>
  )
}
