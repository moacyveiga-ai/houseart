// "Vendas até o repasse" — the compact rows of the prototype: work, buyer · date, value, the six
// segments and the step + the seller's action. Each row opens the sale in the side panel (?sale=).
import Link from 'next/link'
import { formatBRL } from '@/lib/artworks/domain'
import { saleAction, saleSegments, saleStageTitle } from '@/lib/deals/sale-progress-core'
import type { SerializableDeal } from '@/components/deals/deal-view'
import './sales-progress.css'

const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Bahia' })

export function SaleRows({ deals, openId, hrefOf }: { deals: SerializableDeal[]; openId: number | null; hrefOf: (id: number) => string }) {
  return (
    <div className="ha-sales">
      {deals.map((d) => {
        const act = saleAction({ phase: d.phase, sellerSigned: d.sellerSigned, exception: d.exception })
        return (
          <Link key={d.id} href={hrefOf(d.id)} scroll={false} className={`ha-sale${act.tone === 'pending' ? ' ha-sale--pending' : ''}${openId === d.id ? ' ha-sale--on' : ''}`} aria-current={openId === d.id ? 'true' : undefined}>
            <span className="ha-sale__top">
              {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
              <span className="ha-sale__wall">{d.cover ? <img src={d.cover} alt="" /> : null}</span>
              <span className="ha-sale__who"><span className="ha-sale__title">{d.artworkTitle}</span><span className="ha-sale__sub">{d.buyerName} · {day(d.createdAt)}</span></span>
              <span className="ha-sale__value">{formatBRL(BigInt(d.amountCents))}</span>
            </span>
            <span className="ha-sale__segs" aria-hidden="true">{saleSegments(d.phase).map((s, i) => <span key={i} className={`ha-sale__seg ha-sale__seg--${s}`} />)}</span>
            <span className="ha-sale__foot"><span className="ha-sale__stage">{saleStageTitle(d.phase, d.exception)}</span><span className={`ha-sale__pill ha-sale__pill--${act.tone}`}>{act.label}</span></span>
          </Link>
        )
      })}
    </div>
  )
}
