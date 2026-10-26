// Verificação (handoff "HouseArt Verificacao"): the public certificate page — the
// three states (autenticada / contestada / roubada), the tag reading, the artwork
// on the wall, the sheet, the chain of ownership and the sale. Server Component.
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { ArtworkFrame } from '@/components/ds/ArtworkFrame'
import { ArtworkId } from '@/components/ds/ArtworkId'
import { CertificateSheet } from '@/components/ds/CertificateSheet'
import { ProvenanceChain, type ProvenanceEvent } from '@/components/ds/ProvenanceChain'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import type { PublicCertificate, VerificationVerdict } from '@/lib/certificates/server'
import { formatBRL } from '@/lib/artworks/domain'
import { dataBR, noFuso } from '@/lib/timezone'
import { VerificationReader } from './VerificationReader'
import './verification.css'

export interface TagRead { authenticated: boolean; tamper: boolean }

const longDate = (v: string | null) => noFuso(v, { day: 'numeric', month: 'long', year: 'numeric' })
const monthYear = (v: string | null) => noFuso(v, { month: 'long', year: 'numeric' })
const year = (v: string) => noFuso(v, { year: 'numeric' })

const BANNER: Record<VerificationVerdict, { icon: string; title: string }> = {
  authenticated: { icon: 'verified', title: 'Obra autenticada' },
  contested: { icon: 'report', title: 'Autenticidade contestada' },
  stolen: { icon: 'gpp_bad', title: 'Obra registrada como roubada' },
}

function bannerText(c: PublicCertificate, read: TagRead | null): string {
  if (c.verdict === 'stolen') return `O titular comunicou o furto${c.stolenAt ? ` em ${dataBR(c.stolenAt)}` : ''}. Não compre esta obra e avise o suporte.`
  if (c.verdict === 'contested') return `Há uma contestação aberta sobre esta obra${c.disputedAt ? ` desde ${dataBR(c.disputedAt)}` : ''}. Antes de comprar, fale com o suporte.`
  if (read?.authenticated) return 'Etiqueta lida agora e conferida com o certificado registrado.'
  return 'Certificado registrado e assinado na HouseArt.'
}

function markerLine(c: PublicCertificate, read: TagRead | null): string {
  if (read?.tamper) return 'Violada · em revisão'
  if (c.verdict === 'stolen') return 'Bloqueada'
  if (c.verdict === 'contested') return 'Íntegra · em revisão'
  if (read && !read.authenticated) return 'Leitura não confirmada'
  return `Íntegra · vinculada em ${dataBR(c.issuedAt)}`
}

const EVENT_ICON: Record<string, string> = { CREATED: 'brush', CERTIFIED: 'verified', LISTED: 'storefront', TRANSFERRED: 'swap_horiz', LOANED: 'museum', RESTORED: 'build', STOLEN: 'gpp_bad', DISPUTED: 'report', INSURED: 'shield' }

function provenanceOf(c: PublicCertificate): ProvenanceEvent[] {
  const party = (kind: string): string => {
    switch (kind) {
      case 'CREATED': return c.artist
      case 'CERTIFIED': return 'Assinatura digital · carimbo do tempo'
      case 'LISTED': return c.sale ? c.sale.seller : 'Marketplace HouseArt'
      case 'TRANSFERRED': return c.holder ?? 'Novo titular registrado'
      case 'DISPUTED': return 'Em análise pela HouseArt'
      case 'STOLEN': return 'Comunicado pelo titular'
      default: return 'Registrado no certificado'
    }
  }
  return c.events.map((e) => ({ icon: EVENT_ICON[e.kind] ?? 'history', event: e.label, party: party(e.kind), date: e.kind === 'CREATED' ? year(e.at) : dataBR(e.at) }))
}

export function Verification({ c, read }: { c: PublicCertificate; read: TagRead | null }) {
  const b = BANNER[c.verdict]
  const alert = c.verdict !== 'authenticated'
  const meta = [c.artwork.technique, c.artwork.dimensions, c.artwork.edition ?? 'obra única'].filter(Boolean).join(' · ')
  return (
    <div className="hp-verification">
      <article className="hp-verification__card">
        {read ? <VerificationReader result={read.tamper ? 'tamper' : read.authenticated ? 'valid' : 'unverified'} verdict={c.verdict} /> : null}

        <header className="hp-verification__top">
          <HouseArtLogo version="full_horiz" tone="color" height={30} />
          <span>Verificação pública</span>
        </header>

        <div className={`hp-verification-banner hp-verification-banner--${c.verdict}`}>
          <Icon name={b.icon} size={36} filled />
          <div><h2>{b.title}</h2><p>{bannerText(c, read)}</p></div>
        </div>
        {!read ? <div className="hp-verification-note"><Icon name="contactless" size={18} />Leitura não autenticada (sem etiqueta)</div> : null}

        <div className={`hp-verification-wall${c.verdict === 'stolen' ? ' hp-verification-wall--stolen' : ''}`}>
          {c.artwork.cover ? <ArtworkFrame src={c.artwork.cover} alt={`${c.artwork.title}, de ${c.artist}`} mode="canvas" /> : <div className="hp-verification-wall__empty">Sem imagem pública</div>}
        </div>

        <div className="hp-verification-title">
          <Link href={`/e/artist/${c.artistSlug}`} className="hp-verification-title__artist">{c.artist}{c.artistMeta ? <> <small>{c.artistMeta}</small></> : null}</Link>
          <h1>{c.artwork.title}{c.artwork.year ? <>, <span>{c.artwork.year}</span></> : null}</h1>
          <div className="hp-verification-title__meta">{meta}</div>
        </div>

        <dl className="hp-verification-kv">
          <div className="hp-verification-kv__row"><dt>ID da obra</dt><dd><ArtworkId id={c.publicId} qr={false} /></dd></div>
          <div className="hp-verification-kv__row"><dt>Certificada em</dt><dd>{longDate(c.issuedAt)}</dd></div>
          <div className="hp-verification-kv__row"><dt>Titular atual</dt><dd>{c.holder ?? '—'}</dd></div>
          <div className="hp-verification-kv__row"><dt>Etiqueta de autenticação</dt><dd>{markerLine(c, read)}</dd></div>
          <div className="hp-verification-kv__row"><dt>Laudo de valor</dt><dd>{c.appraisalIssuedAt ? `Sim · emitido em ${monthYear(c.appraisalIssuedAt)}` : 'Não'}</dd></div>
        </dl>

        <section className="hp-verification-section">
          <h2>Certificado</h2>
          <CertificateSheet c={{
            number: c.publicId, src: c.artwork.cover, work: `${c.artwork.title}${c.artwork.year ? `, ${c.artwork.year}` : ''}`, artist: c.artist,
            technique: [c.artwork.technique, c.artwork.dimensions].filter(Boolean).join(' · ') || '—', holder: c.holder ?? '—',
            marker: c.issuedAt ? `vinculada em ${dataBR(c.issuedAt)}` : '—', signedBy: `por ${c.artist} · HouseArt`,
            timestamp: c.issuedAt ? `Carimbo do tempo · ${dataBR(c.issuedAt)}` : 'Sem carimbo do tempo',
            holders: `${c.holders} ${c.holders === 1 ? 'titular' : 'titulares'} desde a emissão`,
          }} />
        </section>

        <section className="hp-verification-section">
          <h2>Cadeia de titularidade</h2>
          {c.events.length ? <ProvenanceChain events={provenanceOf(c)} /> : <p className="hp-verification-empty">Nenhum evento registrado.</p>}
        </section>

        {c.sale && !alert ? (
          <div className="hp-verification-sale">
            <div className="hp-verification-sale__row"><span>À venda na <b>{c.sale.seller}</b></span>{c.sale.priceCents ? <span className="hp-verification-sale__price">{formatBRL(BigInt(c.sale.priceCents))}</span> : <span className="hp-verification-sale__price">Sob consulta</span>}</div>
            <Link href={`/e/artwork/${c.publicId}`} className="hp-verification-cta">Solicitar contato com o vendedor</Link>
          </div>
        ) : null}

        <div className="hp-verification-actions">
          {alert ? <Link href="/e/how-it-works#suporte" className="hp-verification-cta hp-verification-cta--ink">Falar com o suporte</Link> : null}
          <Link href="/e/how-it-works#suporte" className="hp-verification-cta hp-verification-cta--outline"><Icon name="flag" size={18} />Reportar problema</Link>
        </div>

        <footer className="hp-verification-foot">
          <div className="hp-verification-foot__seal">
            <div className="hp-verification-foot__ring"><Icon name="contactless" size={22} /></div>
            <div><div className="hp-verification-foot__name">Selo HouseArt</div><div className="hp-verification-foot__by">by House</div></div>
          </div>
          <p>Cada obra tem uma etiqueta de autenticação única no verso; ao aproximar o celular, esta página confirma a etiqueta e mostra o certificado registrado e assinado.</p>
          <small>Sem login · dados do titular protegidos</small>
          <p>Esta página não mostra valores de aquisição nem documentos. Para contestar a titularidade, escreva para a equipe HouseArt.</p>
        </footer>
      </article>
    </div>
  )
}
