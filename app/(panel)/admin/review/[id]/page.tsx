import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../../_session'
import { hasTotalScope } from '@/lib/auth'
import { reviewItemDetail, type ReviewArtwork } from '@/lib/admin-review/detail-server'
import { REVIEW_KIND_LABELS, REVIEW_KIND_TONES } from '@/lib/admin-review/core'
import { certificateLine, CONTEXT_TITLES, SEAL_LABELS } from '@/lib/admin-review/detail-core'
import { ARTWORK_STATUS_LABELS, type ArtworkStatus } from '@/lib/artworks/domain'
import { MARKER_STATUS_LABELS, READ_PURPOSE_LABELS, type ReadPurpose } from '@/lib/physical-markers/domain'
import { Icon } from '@/components/ds/Icon'
import { ReviewQueue } from '@/components/admin/ReviewQueue'
import '@/components/admin/review-detail.css'

export const metadata = { title: 'Item da revisão — HouseArt' }

function WorkCard({ a, label }: { a: ReviewArtwork; label: string }) {
  return (
    <section className="ha-rvd__work" aria-label={label}>
      <span className="ha-rvd__wall">{/* eslint-disable-next-line @next/next/no-img-element -- public derivative */}
        {a.cover ? <img src={a.cover} alt="" /> : <Icon name="imagesmode" size={28} />}</span>
      <span className="ha-rvd__facts">
        <span className="ha-rvd__eyebrow">{label}</span>
        <b><i>{a.title}</i>{a.year ? `, ${a.year}` : ''}</b>
        <span>{a.artist}{a.seller ? ` · conta ${a.seller}` : ''}</span>
        <span className="ha-rvd__sub">{ARTWORK_STATUS_LABELS[a.status as ArtworkStatus] ?? a.status} · {SEAL_LABELS[a.seal] ?? a.seal}</span>
        <span className="ha-rvd__sub">Certificado: {certificateLine(a.certificate)}</span>
        {a.publicId ? <Link href={`/verify/${a.publicId}`} className="ha-rvd__link" target="_blank">Ver certificado público <span className="ha-id">{a.publicId}</span> →</Link> : <span className="ha-rvd__sub">Ainda sem ID público</span>}
      </span>
    </section>
  )
}

export default async function ReviewItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePanelPage('/admin/review')
  if (!hasTotalScope(user)) notFound()
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const d = await reviewItemDetail(id)
  if (!d) notFound()
  const tone = REVIEW_KIND_TONES[d.kind]
  const ctx = d.context
  return (
    <div className="ha-page ha-rvd">
      <Link href="/admin/review" className="ha-rvd__back"><Icon name="arrow_back" size={18} />Fila de revisão</Link>
      <div className="ha-page__head">
        <div>
          <span className="ha-review__kind" style={{ background: `var(${tone.bg})`, color: `var(${tone.fg})` }}>{REVIEW_KIND_LABELS[d.kind]}</span>
          <h1 className="ha-h1">Item #{d.id}</h1>
          <p className="ha-muted ha-sm">Aberto em {d.openedAt} · {d.ago}</p>
        </div>
      </div>
      {d.artwork ? <WorkCard a={d.artwork} label="Obra em revisão" /> : <p className="ha-muted">Sem obra vinculada.</p>}
      <section className="ha-rvd__ctx" aria-labelledby="rvd-ctx">
        <h2 id="rvd-ctx" className="ha-h3">{CONTEXT_TITLES[d.kind]}</h2>
        {ctx.kind === 'TEXT' ? <p className="ha-rvd__text">{ctx.text}</p> : null}
        {ctx.kind === 'DUPLICATE' ? (<>
          <p className="ha-sm"><b>{ctx.similarity}</b> · a conta disse que são obras diferentes</p>
          {ctx.other ? <WorkCard a={ctx.other} label="Obra parecida" /> : <p className="ha-muted ha-sm">A obra parecida não existe mais.</p>}
        </>) : null}
        {ctx.kind === 'MARKER_REMOVED' ? (<>
          <p className="ha-sm">{ctx.uid ? <>Etiqueta <span className="ha-id">{ctx.uid}</span> · {MARKER_STATUS_LABELS[ctx.markerStatus as keyof typeof MARKER_STATUS_LABELS] ?? ctx.markerStatus}</> : 'A etiqueta já foi desvinculada desta obra.'}</p>
          {ctx.reads.length ? <ul className="ha-rvd__list">{ctx.reads.map((r, i) => (
            <li key={i}><span>{r.at} · {READ_PURPOSE_LABELS[r.purpose as ReadPurpose] ?? r.purpose}</span><span className={r.tamper ? 'ha-rvd__alert' : 'ha-rvd__sub'}>{r.tamper ? 'violação' : 'íntegra'}{r.authenticated ? '' : ' · não autenticada'}</span></li>
          ))}</ul> : null}
        </>) : null}
        {ctx.kind === 'MESSAGE_REPORT' ? (<>
          <p className="ha-sm">Denúncia de <b>{ctx.reporter ?? 'conta removida'}</b>: {d.reason}</p>
          {ctx.messages.length ? <ol className="ha-rvd__list">{ctx.messages.map((m) => (
            <li key={m.id} className={m.system ? 'ha-rvd__sys' : undefined}><span><b>{m.who}</b> · {m.at}</span><span className="ha-rvd__body">{m.body}</span></li>
          ))}</ol> : <p className="ha-muted ha-sm">A conversa não tem mensagens.</p>}
        </>) : null}
      </section>
      <section aria-labelledby="rvd-dec">
        <h2 id="rvd-dec" className="ha-h3">Decisão</h2>
        <ReviewQueue detailLinks={false} readOnly={d.decided !== null} items={[{ id: d.id, kind: d.kind, reason: d.reason, ago: d.ago, artwork: d.artwork ? { id: d.artwork.id, title: d.artwork.title, year: d.artwork.year, publicId: d.artwork.publicId, artist: d.artwork.artist, cover: d.artwork.cover } : null, decided: d.decided ? { decision: d.decided.decision, by: d.decided.by, ago: d.decided.at, note: d.decided.note } : null }]} />
      </section>
    </div>
  )
}
