// "Minha coleção": title, summary, the + button, four KPIs and the five tabs of
// HouseArt Web Colecionador.dc.html. Server Component; each tab is its own page.
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { formatBRL } from '@/lib/artworks/domain'
import type { CollectionSummary } from '@/lib/collector-wallet/collection-server'
import { changeLabel, valuationNote } from '@/lib/collector-wallet/valuation-core'
import './collection.css'

export type CollectionTab = 'works' | 'saved' | 'liked' | 'purchases' | 'sales'

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const thousands = (cents: bigint) => {
  const reais = Number(cents / 100n)
  return reais >= 1_000_000 ? `R$ ${(reais / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : reais >= 1000 ? `R$ ${Math.round(reais / 1000).toLocaleString('pt-BR')} mil` : formatBRL(cents)
}

export function CollectionHeader({ s, active }: { s: CollectionSummary; active: CollectionTab }) {
  const tabs: { key: CollectionTab; label: string; href: string }[] = [
    { key: 'works', label: `Obras · ${s.works}`, href: '/wallet' },
    { key: 'saved', label: `Favoritos · ${s.saved}`, href: '/favorites' },
    { key: 'liked', label: `Curtidos · ${s.liked}`, href: '/favorites?tab=liked' },
    { key: 'purchases', label: `Compras · ${s.purchases}`, href: '/purchases' },
    { key: 'sales', label: s.newSales ? `Vendas · ${s.newSales} ${plural(s.newSales, 'nova', 'novas')}` : 'Vendas', href: '/sales' },
  ]
  const kpis = [
    { icon: 'imagesmode', v: String(s.works), k: plural(s.works, 'obra', 'obras') },
    { icon: 'account_balance', v: s.registeredCents > 0n ? thousands(s.registeredCents) : '—', k: 'valor registrado' },
    { icon: s.valuation && s.valuation.changeBps < 0 ? 'trending_down' : 'trending_up', v: s.valuation ? changeLabel(s.valuation.changeBps) : '—', k: 'valorização', tone: s.valuation ? (s.valuation.changeBps > 0 ? 'up' : s.valuation.changeBps < 0 ? 'down' : null) : null },
    { icon: 'palette', v: String(s.artists), k: plural(s.artists, 'artista', 'artistas') },
  ]
  return (
    <header className="ha-col">
      <div className="ha-col__top">
        <div className="ha-col__title">
          <h1 className="ha-h1">Minha coleção</h1>
          <span className="ha-muted ha-sm">{s.works ? `${s.works} ${plural(s.works, 'obra', 'obras')} de ${s.artists} ${plural(s.artists, 'artista', 'artistas')} no seu nome` : 'Nenhuma obra no seu nome ainda'}</span>
        </div>
        <Link href="/wallet/register" className="ha-col__add" aria-label="Adicionar nova obra" title="Adicionar nova obra"><Icon name="add" /></Link>
      </div>
      <div className="ha-col__kpis">
        {kpis.map((k) => (
          <div key={k.k} className={`ha-col__kpi${'tone' in k && k.tone ? ` ha-col__kpi--${k.tone}` : ''}`}><Icon name={k.icon} size={16} /><b>{k.v}</b><span>{k.k}</span></div>
        ))}
      </div>
      {s.valuation ? <p className="ha-col__note ha-muted ha-sm">{valuationNote(s.valuation, s.works, thousands)}</p> : null}
      <nav className="ha-tabs ha-col__tabs" aria-label="Minha coleção">
        {tabs.map((t) => <Link key={t.key} href={t.href} className={`ha-tab${t.key === active ? ' ha-tab--on' : ''}`} aria-current={t.key === active ? 'page' : undefined}>{t.label}</Link>)}
      </nav>
    </header>
  )
}
