import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { ListForSaleDialog } from '@/components/artworks/ListForSaleDialog'
import type { UnlistedState } from './unlisted-core'

/** The listing page of an artwork that is not for sale: where it is and the next step (`unlistedState`). */
export function UnlistedCard({ artworkId, title, listPriceCents, state }: { artworkId: number; title: string; listPriceCents: bigint | null; state: UnlistedState }) {
  const a = state.action
  return (
    <section className="ha-card ha-row" style={{ padding: 'var(--ha-space-5)', gap: 'var(--ha-space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <Icon name={state.icon} size={28} />
      <div className="ha-stack" style={{ gap: 'var(--ha-space-1)', flex: '1 1 260px' }}>
        <b>{state.title}</b>
        <span className="ha-muted ha-sm">{state.sub}</span>
      </div>
      {a?.kind === 'link' ? <Link href={a.href} className="ha-btn ha-btn--ink ha-btn--sm"><Icon name={a.icon} size={18} />{a.label}</Link> : null}
      {a?.kind === 'sell' ? <ListForSaleDialog artworkId={artworkId} title={title} defaultPrice={listPriceCents ? String(listPriceCents / 100n) : ''} listed={false} /> : null}
    </section>
  )
}
