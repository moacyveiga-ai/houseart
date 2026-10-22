// "Galeria · painel do dia" (handoff "HouseArt Web Galeria" › Galeria): the KPIs
// (the first one dark), "Precisa de você", "Obras mais vistas · últimos 7 dias"
// and the shortcuts that exist. Server Component; the page feeds it.
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import type { DayPanel as DayPanelData } from '@/lib/gallery/panel-server'
import './day-panel.css'

export interface TopViewed { id: number; title: string; coverUrl: string | null; views7d: number; openOffers: number }

export function DayPanel({ data, who, top }: { data: DayPanelData; who: { initials: string; name: string; dateLabel: string }; top: TopViewed[] }) {
  const n = data.actions.length
  const max = top.length ? Math.max(...top.map((t) => t.views7d)) : 1
  return (
    <div className="ha-dp">
      <div className="ha-dp__head">
        <span className="ha-dp__avatar" aria-hidden="true">{who.initials}</span>
        <span className="ha-dp__who"><span className="ha-dp__date">{who.dateLabel}</span><h1 className="ha-dp__name">{who.name}</h1></span>
      </div>
      <div className="ha-dp__kpis">
        {data.kpis.map((k) => (
          <Link key={k.key} href={k.href} className={`ha-dp__kpi${k.dark ? ' ha-dp__kpi--dark' : ''}`}>
            <span className="ha-dp__kpi-label"><Icon name={k.icon} size={16} />{k.label}</span>
            <span className="ha-dp__kpi-value">{k.value}</span>
            <span className="ha-dp__kpi-detail">{k.detail}</span>
          </Link>
        ))}
      </div>
      <section className="ha-dp__section" aria-labelledby="dp-actions">
        <div className="ha-dp__section-head"><h2 id="dp-actions" className="ha-dp__section-title">Precisa de você</h2><span className="ha-dp__section-note">{n} {n === 1 ? 'item' : 'itens'}</span></div>
        {n === 0 ? <div className="ha-dp__clear"><Icon name="task_alt" size={22} />Tudo em dia por aqui.</div> : data.actions.map((a, i) => (
          <Link key={`${a.title}-${i}`} href={a.href} className={`ha-dp__action ha-dp__action--${a.tone}`}>
            <span className="ha-dp__action-icon"><Icon name={a.icon} size={20} /></span>
            <span className="ha-dp__action-text"><span className="ha-dp__action-title">{a.title}</span><span className="ha-dp__action-sub">{a.sub}</span></span>
            <span className="ha-dp__tag">{a.tag}</span>
          </Link>
        ))}
      </section>
      <section className="ha-dp__section" aria-labelledby="dp-top">
        <div className="ha-dp__section-head"><h2 id="dp-top" className="ha-dp__section-title">Obras mais vistas</h2><span className="ha-dp__section-note">últimos 7 dias</span></div>
        {top.length === 0 ? <p className="ha-dp__empty">Nenhuma visualização nos últimos 7 dias.</p> : top.map((t) => (
          <Link key={t.id} href={`/artworks/${t.id}/listing`} className="ha-dp__top">
            <span className="ha-dp__top-wall">{/* eslint-disable-next-line @next/next/no-img-element -- derivative served by the public store */}
              {t.coverUrl ? <img src={t.coverUrl} alt="" /> : null}</span>
            <span className="ha-dp__top-body">
              <span className="ha-dp__top-line"><span className="ha-dp__top-title">{t.title}</span><span className="ha-dp__top-views">{t.views7d.toLocaleString('pt-BR')}</span></span>
              <span className="ha-dp__bar" aria-hidden="true"><span style={{ width: `${Math.round((t.views7d / max) * 100)}%` }} /></span>
              <span className="ha-dp__top-stats">{t.openOffers} {t.openOffers === 1 ? 'oferta' : 'ofertas'}</span>
            </span>
          </Link>
        ))}
      </section>
      <div className="ha-dp__shortcuts">
        <Link href="/artworks/new" className="ha-dp__shortcut"><Icon name="add_photo_alternate" size={22} />Nova obra</Link>
        <Link href="/e/marketplace" className="ha-dp__shortcut"><Icon name="storefront" size={22} />Ver marketplace</Link>
      </div>
    </div>
  )
}
