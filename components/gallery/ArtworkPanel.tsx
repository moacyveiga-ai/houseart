// The artwork of the gallery's Acervo in the side panel (handoff "HouseArt Web Galeria" › Acervo ›
// obra): photo and thumbnails, artist · year, ficha, price and status, "Gestão do anúncio" for a
// listed work, the certificate and the provenance. Server Component around the client SidePanel;
// it receives only display fields (never hashes, the vault key nor the floor).
import Link from 'next/link'
import { SidePanel } from '@/components/ds/SidePanel'
import { Icon } from '@/components/ds/Icon'
import { ListingManager, type ListingState } from './ListingManager'
import type { ToggleRules } from './listing-manager-core'
import './artwork-panel.css'
import '@/components/sales/sales-progress.css'

export interface ArtworkPanelData {
  id: number; title: string; year: number | null; artist: string; publicId: string | null
  status: string; statusLabel: string; statusTone: string; price: string
  images: { url: string; label: string }[]
  facts: { k: string; v: string }[]
  certificate: { issuedAt: string | null; status: string } | null
  provenance: { label: string; at: string }[]
}

const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bahia' })

export function ArtworkPanel({ a, closeHref, listing, rules, canManage, canTransfer = false, blockedReason }: { a: ArtworkPanelData; closeHref: string; listing: ListingState | null; rules: ToggleRules | null; canManage: boolean; canTransfer?: boolean; blockedReason: string }) {
  const [cover, ...thumbs] = a.images
  const footer = (
    <>
      {a.status === 'LISTED' && a.publicId ? <Link href={`/e/artwork/${a.publicId}`} className="ha-sd__btn ha-sd__btn--primary"><Icon name="open_in_new" size={20} />Ver página pública</Link> : null}
      {a.status === 'IN_CERTIFICATION' && !a.publicId ? <Link href={`/certification/link/${a.id}`} className="ha-sd__btn ha-sd__btn--primary"><Icon name="contactless" size={20} />Vincular etiqueta</Link> : null}
      {a.status === 'IN_DEAL' ? <Link href="/sales?tab=deals" className="ha-sd__btn ha-sd__btn--primary"><Icon name="local_shipping" size={20} />Acompanhar a venda</Link> : null}
      {a.status === 'IN_CERTIFICATION' && a.publicId ? <Link href="/certification" className="ha-sd__btn ha-sd__btn--primary"><Icon name="draw" size={20} />Assinar e emitir o certificado</Link> : null}
      {['DRAFT', 'IN_CERTIFICATION', 'AUTHENTICATED'].includes(a.status) ? <Link href={`/artworks/${a.id}/edit`} className="ha-sd__btn"><Icon name="edit" size={20} />Editar cadastro</Link> : null}
    </>
  )
  return (
    <SidePanel title={a.title} closeHref={closeHref} footer={footer}>
      <div className="ha-ap__photo">
        {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
        {cover ? <img src={cover.url} alt={a.title} /> : <Icon name="imagesmode" size={40} />}
      </div>
      {thumbs.length ? (
        <ul className="ha-ap__thumbs" aria-label="Outras fotos">
          {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
          {thumbs.slice(0, 8).map((t) => <li key={t.url}><img src={t.url} alt={t.label} title={t.label} /></li>)}
        </ul>
      ) : null}
      <div className="ha-stack" style={{ gap: 4 }}>
        <span className="ha-muted ha-sm">{a.artist}{a.year ? ` · ${a.year}` : ''}</span>
        <h2 className="ha-ap__title">{a.title}</h2>
        <span className="ha-ap__price"><b>{a.price}</b><span className={`ha-inv__pill ha-inv__pill--${a.statusTone}`}>{a.statusLabel}</span></span>
      </div>
      <dl className="ha-ap__facts">{a.facts.map((f) => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd></div>)}</dl>
      {listing ? (
        <section className="ha-stack" style={{ gap: 8 }}>
          <h3 className="ha-ap__h">Gestão do anúncio</h3>
          <ListingManager canManage={canManage} canTransfer={canTransfer} blockedReason={blockedReason} artworkId={a.id} title={a.title} artistName={a.artist} publicId={a.publicId} year={a.year} cover={cover?.url ?? null} rules={rules} initial={listing} />
        </section>
      ) : null}
      <section className="ha-stack" style={{ gap: 8 }}>
        <h3 className="ha-ap__h">Certificado</h3>
        {a.certificate?.issuedAt && a.publicId ? (
          <div className="ha-ap__cert">
            <Icon name="verified" size={22} />
            <span className="ha-stack" style={{ gap: 0, flex: 1 }}><b className="ha-sm">{a.publicId}</b><span className="ha-muted ha-sm">Emitido em {day(a.certificate.issuedAt)}{a.certificate.status !== 'ACTIVE' ? ` · ${a.certificate.status === 'CONTESTED' ? 'contestado' : 'revogado'}` : ''}</span></span>
            <Link href={`/verify/${a.publicId}`} className="ha-link ha-sm">Ver certificado público →</Link>
          </div>
        ) : <p className="ha-muted ha-sm" style={{ margin: 0 }}>{a.status === 'DRAFT' ? 'Envie a obra para a certificação para receber o certificado.' : 'Certificado em emissão: vincule a etiqueta e assine.'}</p>}
      </section>
      {a.provenance.length ? (
        <section className="ha-stack" style={{ gap: 8 }}>
          <h3 className="ha-ap__h">Proveniência</h3>
          <ol className="ha-ap__prov">{a.provenance.map((p, i) => <li key={i}><span>{p.label}</span><span className="ha-muted">{day(p.at)}</span></li>)}</ol>
        </section>
      ) : null}
    </SidePanel>
  )
}
