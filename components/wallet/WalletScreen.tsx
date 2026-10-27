// "Minha coleção › Obras" / "Carteira de escrituras": the works the person holds. Each row opens the
// work in the side panel (?own=<artworkId>), where the deed and the owner's actions live — Serviços,
// Vender esta obra, Transferir, Segurar, Pedir laudo (handoff "HouseArt Web Colecionador" › obra).
import Link from 'next/link'
import { Badge } from '@/components/ds/Badge'
import { Icon } from '@/components/ds/Icon'
import { formatBRL } from '@/lib/artworks/domain'
import type { WalletItem } from '@/lib/collector-wallet/server'
import type { CollectorDraftRow } from '@/lib/collectors/server'
import type { ArrivingPurchase } from '@/lib/deals/server'

/** The deed plus its status (the row's badge). */
export type WalletScreenItem = WalletItem & { status: string; sealGreen: boolean; registeredCents: string | null }

function badgeOf(it: WalletScreenItem): { tone: 'verified' | 'pending' | 'neutral'; label: string } {
  if (it.status === 'LISTED') return { tone: 'verified', label: 'À venda' }
  if (it.status === 'IN_DEAL') return { tone: 'pending', label: 'Em venda' }
  if (!it.sealGreen) return { tone: 'pending', label: 'Em revisão' }
  return it.insured ? { tone: 'verified', label: 'Segurada' } : { tone: 'neutral', label: 'Sem seguro' }
}

export function WalletScreen({ items, totalCents, holderName, inCollection = false, openId = null, drafts = [], arriving = [] }: { items: WalletScreenItem[]; totalCents: string; holderName: string; inCollection?: boolean; openId?: number | null; drafts?: CollectorDraftRow[]; arriving?: ArrivingPurchase[] }) {
  return (
    <section className="ha-stack">
      <div className="ha-row" style={{ justifyContent: 'space-between' }}><span className="ha-eyebrow">{holderName}</span><span className="ha-row" style={{ gap: 'var(--ha-space-4)' }}><Link href="/wallet/register" className="ha-btn ha-btn--ink ha-btn--xs"><Icon name="add_photo_alternate" size={18} />Cadastrar obra</Link><Link href="/wallet/cards" className="ha-link ha-link--quiet ha-sm">Cartões →</Link></span></div>
      {inCollection ? null : <h1 className="ha-h1">Carteira de escrituras</h1>}
      {inCollection ? null : <div className="ha-row"><span className="ha-muted">Valor registrado · {items.length} obra(s)</span><b className="ha-num">{formatBRL(BigInt(totalCents))}</b></div>}
      <ul className="ha-list">
        {/* Compras chegando (handoff "HouseArt Web Colecionador": "Chegando · em trânsito"): the deed is not theirs yet — the row opens the purchase */}
        {arriving.map((p) => (
          <li key={`deal-${p.dealId}`}>
            <Link href="/purchases" className="ha-list__row ha-list__btn" style={{ gridTemplateColumns: '40px 1fr auto auto', width: '100%', color: 'inherit', textDecoration: 'none' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
              <span className="ha-wall ha-wall--40">{p.cover ? <img src={p.cover} alt="" /> : null}</span>
              <span style={{ textAlign: 'left' }}><b>{p.title}</b><br /><span className="ha-muted ha-sm">{p.artist} · compra em andamento</span></span>
              <span className="ha-row ha-sm" style={{ gap: 'var(--ha-space-2)' }}><Icon name="local_shipping" size={18} />Acompanhar</span>
              <Badge tone="pending">{p.label}</Badge>
            </Link>
          </li>
        ))}
        {items.length === 0 && arriving.length === 0 ? <li className="ha-muted">Nenhuma escritura ainda. Uma obra que já é sua entra pela opção Cadastrar obra; a que você comprar na HouseArt chega aqui depois da entrega.</li> : null}
        {items.map((it) => {
          const b = badgeOf(it)
          const on = openId === it.artworkId
          return (
            <li key={it.artworkId}>
              <Link href={`/wallet?own=${it.artworkId}`} scroll={false} aria-current={on ? 'true' : undefined} className="ha-list__row ha-list__btn" style={{ gridTemplateColumns: '40px 1fr auto auto', width: '100%', borderColor: on ? 'var(--ha-ink-900)' : undefined, color: 'inherit', textDecoration: 'none' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
                <span className="ha-wall ha-wall--40">{it.cover ? <img src={it.cover} alt="" /> : null}</span>
                <span style={{ textAlign: 'left' }}><b>{it.title}</b><br /><span className="ha-muted ha-sm">{it.artist} · adquirida em {it.acquiredAt}</span></span>
                <span className="ha-num">{it.priceLabel}</span>
                <Badge tone={b.tone}>{b.label}</Badge>
              </Link>
            </li>
          )
        })}
      </ul>
      {items.length ? <p className="ha-muted ha-sm" style={{ margin: 0 }}>Toque numa obra para ver a escritura, vender, pedir serviços ou transferir.</p> : null}
      {drafts.length ? (<>
        <h2 className="ha-h3" style={{ marginTop: 'var(--ha-space-4)' }}>Em cadastro</h2>
        <ul className="ha-list">
          {drafts.map((d) => {
            const row = (<>
              {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
              <span className="ha-wall ha-wall--40">{d.cover ? <img src={d.cover} alt="" /> : null}</span>
              <span style={{ textAlign: 'left' }}><b>{d.title}</b><br /><span className="ha-muted ha-sm">{d.artist}</span></span>
              {d.href ? <span className="ha-link ha-sm">{d.completed ? 'Ver' : 'Continuar'}</span> : <span />}
              <Badge tone={d.href ? 'neutral' : 'pending'}>{!d.href ? 'Em certificação' : d.completed ? 'Cadastrada' : 'Rascunho'}</Badge>
            </>)
            const style = { gridTemplateColumns: '40px 1fr auto auto', width: '100%', color: 'inherit', textDecoration: 'none' }
            return <li key={d.id}>{d.href ? <Link href={d.href} className="ha-list__row ha-list__btn" style={style}>{row}</Link> : <span className="ha-list__row" style={style}>{row}</span>}</li>
          })}
        </ul>
      </>) : null}
    </section>
  )
}
