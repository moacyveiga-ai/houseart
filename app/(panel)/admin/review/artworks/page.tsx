import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../../_session'
import { hasTotalScope } from '@/lib/auth'
import { adminArtworks } from '@/lib/admin-artworks/server'
import { ARTWORK_FILTER_LABELS, ARTWORK_FILTERS, filterKey, listHref, versionsLine } from '@/lib/admin-artworks/core'
import { CERTIFICATE_STATUS_LABELS, SEAL_LABELS } from '@/lib/admin-review/detail-core'
import { ARTWORK_STATUS_LABELS, type ArtworkStatus } from '@/lib/artworks/domain'
import { dataBR } from '@/lib/timezone'
import { Kpis } from '@/components/ds/Kpi'
import { Chip } from '@/components/ds/Chip'
import { Icon } from '@/components/ds/Icon'
import { Tabs } from '@/components/ds/Tabs'
import '@/components/admin/artworks-admin.css'

export const metadata = { title: 'Todas as obras — HouseArt' }

/** Admin › Obras e certificados › Todas as obras (audit 2026-10-25 web-app §1): read-only list of every
 *  work in any state with its certificate (state, versions, signed/issued) and open review items. */
export default async function AdminArtworksPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; page?: string }> }) {
  const { user } = await requirePanelPage('/admin/review')
  if (!hasTotalScope(user)) notFound()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const f = filterKey(sp.f)
  const d = await adminArtworks({ q, f, page: sp.page })
  return (
    <div className="ha-page ha-aart">
      <div className="ha-page__head"><h1 className="ha-h1">Obras e certificados</h1></div>
      <Tabs active="artworks" items={[{ key: 'queue', label: 'Fila de revisão', href: '/admin/review' }, { key: 'artworks', label: 'Todas as obras', href: '/admin/review/artworks' }]} />
      <Kpis items={[
        { label: 'Obras cadastradas', value: d.kpis.all.toLocaleString('pt-BR'), note: 'em qualquer estado' },
        { label: 'Em certificação', value: d.kpis.certification.toLocaleString('pt-BR'), note: 'esperando etiqueta, assinatura ou emissão' },
        { label: 'Autenticadas', value: d.kpis.certified.toLocaleString('pt-BR'), note: 'certificado emitido' },
        { label: 'Com alerta', value: d.kpis.alert.toLocaleString('pt-BR'), note: 'roubada, em disputa ou com certificado contestado ou revogado' },
      ]} />
      <form className="ha-aart__search" action="/admin/review/artworks" method="get" role="search">
        <label className="ha-field__label" htmlFor="art-q">Buscar</label>
        <div className="ha-aart__searchrow">
          <input id="art-q" className="ha-input" name="q" defaultValue={q} placeholder="título, artista, conta, ID público (HA-…) ou #id" />
          {f !== 'all' ? <input type="hidden" name="f" value={f} /> : null}
          <button type="submit" className="ha-btn ha-btn--secondary ha-btn--md"><Icon name="search" /> Buscar</button>
        </div>
      </form>
      <div className="ha-aart__filters" role="group" aria-label="Filtro">
        {ARTWORK_FILTERS.map((k) => <Chip key={k} on={k === f} href={listHref({ q, f: k })}>{ARTWORK_FILTER_LABELS[k]}</Chip>)}
      </div>
      <p className="ha-muted ha-sm">{d.total.toLocaleString('pt-BR')} {d.total === 1 ? 'obra' : 'obras'}{d.pages > 1 ? ` · página ${d.page} de ${d.pages}` : ''}</p>
      {d.rows.length === 0 ? <p className="ha-aart__empty">Nenhuma obra neste filtro.</p> : (
        <ul className="ha-aart__list">
          {d.rows.map((r) => (
            <li key={r.id} className="ha-aart__row">
              <span className="ha-aart__wall">{/* eslint-disable-next-line @next/next/no-img-element -- public derivative */}
                {r.cover ? <img src={r.cover} alt="" /> : <Icon name="imagesmode" size={22} />}</span>
              <span className="ha-aart__main">
                <b><i>{r.title}</i>{r.year ? `, ${r.year}` : ''}</b>
                <span className="ha-aart__sub">{r.artist}{r.account ? ` · conta ${r.account}` : ''} · #{r.id} · cadastrada {dataBR(r.createdAt)}</span>
                {r.publicId ? <Link href={`/verify/${r.publicId}`} target="_blank" className="ha-aart__id"><span className="ha-id">{r.publicId}</span> →</Link> : <span className="ha-aart__sub">sem ID público</span>}
              </span>
              <span className="ha-aart__state">
                <span>{ARTWORK_STATUS_LABELS[r.status as ArtworkStatus] ?? r.status} · {SEAL_LABELS[r.seal] ?? r.seal}</span>
                {r.certificate ? (
                  <span className={r.certificate.status === 'CONTESTED' || r.certificate.status === 'REVOKED' ? 'ha-aart__alert' : 'ha-aart__sub'}>
                    Certificado {(CERTIFICATE_STATUS_LABELS[r.certificate.status] ?? r.certificate.status).toLowerCase()} · {versionsLine(r.certificate.versions)}
                    {r.certificate.issuedAt ? ` · emitido ${dataBR(r.certificate.issuedAt)}` : r.certificate.signedAt ? ` · assinado ${dataBR(r.certificate.signedAt)}` : ' · não assinado'}
                  </span>
                ) : <span className="ha-aart__sub">Sem certificado</span>}
                {r.openReviews ? <Link href="/admin/review" className="ha-aart__alert">{r.openReviews === 1 ? '1 item aberto na fila' : `${r.openReviews} itens abertos na fila`} →</Link> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {d.pages > 1 ? (
        <nav className="ha-aart__pages" aria-label="Páginas">
          {d.page > 1 ? <Link href={listHref({ q, f, page: d.page - 1 })} className="ha-btn ha-btn--ghost ha-btn--sm">← Anteriores</Link> : <span />}
          {d.page < d.pages ? <Link href={listHref({ q, f, page: d.page + 1 })} className="ha-btn ha-btn--ghost ha-btn--sm">Próximas →</Link> : null}
        </nav>
      ) : null}
    </div>
  )
}
