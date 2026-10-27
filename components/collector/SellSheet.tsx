'use client'
// "Vender uma obra" (handoff "HouseArt App Colecionador" › Vender uma obra, `vender`): the sheet
// the wallet opens for ONE held artwork. Two steps — "Preço e modalidade" (mode cards, the asked
// price, the minimum the person accepts — it never shows to the buyer —, the automatic negotiator
// and its auto-accept percentage) and "Revise o anúncio" (the estimate: 8 % the buyer pays on
// top, 4 % the seller leaves, the resale royalty of 5 % over the appreciation, the net). Without
// the green seal the sheet is the "Certifique primeiro" state and leads to the services sheet.
// POST /api/collector/artworks/<id>/sell → /artworks/<id>/listing.
import { useRef, useState } from 'react'
import { useDialogFocus } from '@/components/ds/useDialogFocus'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Toggle } from '@/components/ds/Toggle'
import { formatBRL } from '@/lib/artworks/domain'
import { mandateProblems } from '@/lib/offers/mandate-core'
import { ROYALTY_PCT, SECONDARY_BUYER_PCT, SECONDARY_SELLER_PCT, autoAcceptBps, formatThousands, reaisDigitsToCents, sellEstimate } from './seller-core'
import { PixKeyForm } from '@/components/sales/PixKeyForm'
import '@/components/sales/payout.css'
import './collector-sheets.css'

export interface SellArtwork { artworkId: number; title: string; artist: string; cover: string | null; status: string; sealGreen: boolean; registeredCents: string | null; /** "Faixa sugerida…" line, computed on the server */ priceRange?: string | null }
/** "Publicar sem Pix abre o cadastro de Pix e depois publica" (prototype): who receives, and whether a way to receive exists. */
export interface SellPayout { ready: boolean; holderName: string; cpfMask: string | null }

export function SellSheet({ artwork: a, open, onClose, onCertify, payout }: { artwork: SellArtwork; open: boolean; onClose: () => void; onCertify: () => void; payout?: SellPayout }) {
  const router = useRouter()
  const [step, setStep] = useState<0 | 1 | 'pix'>(0)
  const [payoutReady, setPayoutReady] = useState(payout?.ready ?? true)
  const [pixSaving, setPixSaving] = useState(false)
  const [mode, setMode] = useState<'offers' | 'fixed'>('offers')
  const [price, setPrice] = useState('')
  const [min, setMin] = useState('')
  const [negotiator, setNegotiator] = useState(true)
  const [acceptPct, setAcceptPct] = useState('92')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sealBlocked, setSealBlocked] = useState(false)

  const box = useRef<HTMLDivElement>(null)
  useDialogFocus(box, open, () => { if (!pixSaving) onClose() })
  if (!open) return null

  const registered = a.registeredCents && /^\d+$/.test(a.registeredCents) ? BigInt(a.registeredCents) : null
  const listCents = reaisDigitsToCents(price)
  const reserveCents = mode === 'fixed' ? listCents : reaisDigitsToCents(min)
  const bps = mode === 'fixed' || !negotiator ? 10000 : autoAcceptBps(acceptPct)
  const problems = listCents > 0n ? mandateProblems({ listPriceCents: listCents, reservePriceCents: reserveCents, autoAcceptMinBps: bps }) : []
  const ok = listCents > 0n && problems.length === 0
  const est = sellEstimate(listCents, registered)
  const blocked = !a.sealGreen || sealBlocked
  const listed = a.status === 'LISTED'

  function tryPublish() {
    if (!payoutReady) { setStep('pix'); return }
    void publish()
  }

  async function publish() {
    setBusy(true); setError('')
    const body = { listPriceCents: listCents.toString(), reservePriceCents: reserveCents.toString(), autoNegotiatorOn: mode === 'offers' && negotiator, autoAcceptMinBps: bps, fixedPrice: mode === 'fixed' }
    let res: Response, data: { href?: string; error?: string; code?: string }
    try {
      res = await fetch(`/api/collector/artworks/${a.artworkId}/sell`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      data = (await res.json().catch(() => ({}))) as { href?: string; error?: string; code?: string }
    } catch { setError('Sem conexão. Tente de novo.'); return } finally { setBusy(false) }
    if (res.ok && data.href) { router.push(data.href); return }
    if (data.code === 'SEAL_REQUIRED') { setSealBlocked(true); return }
    setError(data.error ?? 'Não foi possível anunciar agora.')
  }

  const head = (title: string, stepTxt?: string) => (
    <div className="ha-cs__head">
      <span className="ha-cs__head-t"><span className="ha-cs__title">{title}</span>{stepTxt ? <span className="ha-cs__step">{stepTxt}</span> : null}</span>
      <button type="button" className="ha-iconbtn ha-cs__x" onClick={onClose} disabled={pixSaving} aria-label="Fechar"><Icon name="close" size={24} /></button>
    </div>
  )
  const work = (sub: string) => (
    <div className="ha-cs__work">
      {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
      <span className="ha-wall ha-wall--72">{a.cover ? <img src={a.cover} alt="" /> : null}</span>
      <span className="ha-stack" style={{ gap: 2 }}><span className="ha-cs__work-t">{a.title}</span><span className="ha-cs__work-s">{sub}</span></span>
    </div>
  )

  return (
    <div className="ha-scrim ha-cs-scrim" onClick={() => { if (!pixSaving) onClose() }} role="presentation">
      <div ref={box} tabIndex={-1} className="ha-cs" role="dialog" aria-modal="true" aria-label="Vender uma obra" onClick={(e) => e.stopPropagation()}>
        <div className="ha-cs__grip"><span /></div>
        {blocked ? (<>
          {head('Vender uma obra')}
          <div className="ha-cs__body">
            {work(a.artist)}
            <div className="ha-cs__block">
              <span className="ha-cs__block-i"><Icon name="verified" size={28} /></span>
              <span className="ha-cs__block-t">Certifique primeiro</span>
              <span className="ha-cs__lead">Só obras com o selo verde vão ao marketplace. A certificação confere a obra, cola a etiqueta no verso e emite a escritura em seu nome.</span>
            </div>
          </div>
          <div className="ha-cs__foot"><button type="button" className="ha-btn ha-btn--primary ha-btn--md ha-cs__cta" onClick={onCertify}><Icon name="verified" size={18} />Pedir certificação</button></div>
        </>) : listed ? (<>
          {head('Vender uma obra')}
          <div className="ha-cs__body">
            {work(a.artist)}
            <div className="ha-cs__block">
              <span className="ha-cs__block-i"><Icon name="sell" size={28} /></span>
              <span className="ha-cs__block-t">Esta obra já está à venda</span>
              <span className="ha-cs__lead">Preço, mínimo e negociador ficam na gestão do anúncio.</span>
            </div>
          </div>
          <div className="ha-cs__foot"><Link href={`/artworks/${a.artworkId}/listing`} className="ha-btn ha-btn--ink ha-btn--md ha-cs__cta"><Icon name="tune" size={18} />Gestão do anúncio</Link></div>
        </>) : step === 'pix' && payout ? (<>
          {head('Vender uma obra', 'Pix para receber')}
          <h2 className="ha-cs__h">Cadastre o Pix para receber</h2>
          <div className="ha-cs__body">
            {work('O valor da venda cai nesta chave depois que o comprador confirma a entrega.')}
            <PixKeyForm holderName={payout.holderName} cpfMask={payout.cpfMask} submitLabel="Cadastrar Pix e publicar" onSavingChange={setPixSaving} onSaved={async () => { setPayoutReady(true); setStep(1); await publish() }}
              secondary={<button type="button" className="ha-btn ha-btn--ghost ha-btn--sm" disabled={pixSaving} onClick={() => setStep(1)}>Voltar</button>} />
          </div>
        </>) : step === 0 ? (<>
          {head('Vender uma obra', 'Passo 1 de 2')}
          <div className="ha-cs__segs"><span className="ha-cs__seg ha-cs__seg--on" /><span className="ha-cs__seg" /></div>
          <h2 className="ha-cs__h">Preço e modalidade</h2>
          <div className="ha-cs__body">
            {work(a.artist + (registered ? ` · registrada por ${formatBRL(registered)}` : ''))}
            {a.priceRange ? <div className="ha-cs__hint"><Icon name="insights" size={18} /><span>{a.priceRange}</span></div> : null}
            <div className="ha-cs__modes" role="radiogroup" aria-label="Modalidade">
              {([['offers', 'Aceitar ofertas', 'Você define um mínimo e negocia', 'swap_horiz'], ['fixed', 'Preço fixo', 'Compra direta, sem negociação', 'sell']] as const).map(([k, n, s, icon]) => (
                <button type="button" key={k} role="radio" aria-checked={mode === k} className={`ha-cs__mode${mode === k ? ' ha-cs__mode--on' : ''}`} onClick={() => setMode(k)}>
                  <Icon name={icon} size={22} /><span className="ha-cs__mode-n">{n}</span><span className="ha-cs__mode-s">{s}</span>
                </button>
              ))}
            </div>
            <label className="ha-cs__field"><span className="ha-cs__field-k">Preço pedido</span>
              <span className="ha-cs__money"><span className="ha-cs__money-pre">R$</span><input inputMode="numeric" value={price} placeholder="0" onChange={(e) => setPrice(formatThousands(e.target.value))} /></span>
            </label>
            {mode === 'offers' ? (<>
              <label className="ha-cs__field"><span className="ha-cs__field-k">Mínimo que você aceita <span className="ha-cs__field-n">· nunca aparece para o comprador</span></span>
                <span className={`ha-cs__money${problems.some((p) => p.includes('piso')) ? ' ha-cs__money--error' : ''}`}><span className="ha-cs__money-pre">R$</span><input inputMode="numeric" value={min} placeholder="0" onChange={(e) => setMin(formatThousands(e.target.value))} /></span>
                <span className="ha-cs__field-n">Ofertas abaixo disso são recusadas sem você ver. O valor fica só com você e com o negociador.</span>
              </label>
              <div className="ha-cs__switch">
                <span className="ha-stack" style={{ gap: 2 }}><span className="ha-cs__switch-n">Negociador automático</span><span className="ha-cs__switch-s">Responde às propostas por você, dentro do seu mínimo, e nunca revela o piso.</span></span>
                <Toggle on={negotiator} onChange={setNegotiator} label="Negociador automático" />
              </div>
              {negotiator ? (
                <label className="ha-cs__sub">Aceitar automaticamente acima de
                  <span className="ha-cs__money ha-cs__money--sm"><input inputMode="numeric" value={acceptPct} aria-label="Percentual do preço pedido" onChange={(e) => setAcceptPct(e.target.value.replace(/\D/g, '').slice(0, 3))} /><span className="ha-cs__money-pre">%</span></span>
                </label>
              ) : null}
            </>) : null}
            {problems.length ? <span className="ha-cs__err" role="alert">{problems.join(' ')}</span> : null}
            <span className="ha-cs__note"><Icon name="info" size={16} />Mercado secundário: o comprador paga {SECONDARY_BUYER_PCT} % sobre o preço e {SECONDARY_SELLER_PCT} % saem da sua parte. O artista recebe {ROYALTY_PCT} % da valorização.</span>
          </div>
          <div className="ha-cs__foot"><button type="button" className="ha-btn ha-btn--primary ha-btn--md ha-cs__cta" disabled={!ok} onClick={() => setStep(1)}>Continuar</button></div>
        </>) : (<>
          {head('Vender uma obra', 'Passo 2 de 2')}
          <div className="ha-cs__segs"><span className="ha-cs__seg ha-cs__seg--on" /><span className="ha-cs__seg ha-cs__seg--on" /></div>
          <h2 className="ha-cs__h">Revise o anúncio</h2>
          <div className="ha-cs__body">
            {work(mode === 'offers' ? `Aceita ofertas${negotiator ? ` · negociador aceita acima de ${bps / 100} %` : ''}` : 'Preço fixo')}
            <div className="ha-cs__lines">
              <div className="ha-cs__line ha-cs__line--b"><span className="ha-cs__line-k">Preço pedido</span><span className="ha-cs__line-v">{formatBRL(est.listCents)}</span></div>
              <div className="ha-cs__line"><span className="ha-cs__line-k">Taxa HouseArt · {SECONDARY_SELLER_PCT} % do vendedor</span><span className="ha-cs__line-v">− {formatBRL(est.sellerFeeCents)}</span></div>
              <div className="ha-cs__line"><span className="ha-cs__line-k">Direito de sequência · {ROYALTY_PCT} % da valorização{registered ? '' : ' · sem valor registrado'}</span><span className="ha-cs__line-v">− {formatBRL(est.royaltyCents)}</span></div>
              <div className="ha-cs__line ha-cs__line--b"><span className="ha-cs__line-k">Você recebe · estimativa</span><span className="ha-cs__line-v">{formatBRL(est.netCents)}</span></div>
              <div className="ha-cs__line"><span className="ha-cs__line-k">O comprador paga · com {SECONDARY_BUYER_PCT} % da HouseArt</span><span className="ha-cs__line-v">{formatBRL(est.buyerPaysCents)}</span></div>
            </div>
            <span className="ha-cs__note">O comprador paga em garantia. Você recebe quando ele confirmar a entrega com o toque na etiqueta, e a escritura muda de nome no mesmo instante.</span>
            {registered ? <span className="ha-cs__note">O direito de sequência é calculado sobre o valor registrado ({formatBRL(registered)}); o valor final sai do último preço de venda registrado.</span> : null}
            {error ? <span className="ha-cs__err" role="alert">{error}</span> : null}
          </div>
          <div className="ha-cs__foot ha-cs__cta-row">
            <button type="button" className="ha-btn ha-btn--outline ha-btn--md" onClick={() => setStep(0)} disabled={busy}>Voltar</button>
            <button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={tryPublish} disabled={busy} aria-busy={busy || undefined}>{busy ? 'Publicando…' : 'Publicar no marketplace'}</button>
          </div>
        </>)}
      </div>
    </div>
  )
}
