// HouseArt Obra (handoff 2026-10-21): the public page of one artwork — media,
// head with the language mark, price box with shipping estimate and the offer
// flow, seller, "Sobre a obra" · "Ficha técnica" · "Proveniência", the artist
// band and "Mais desta artista e da galeria". Server Component; the islands are
// ArtworkMedia, ShippingQuote and ArtworkOffer.
import Link from 'next/link'
import './artwork.css'
import { LanguageMark, type Language } from '@/components/layout/HouseArtLogo'
import { ArtworkGrid, type ArtworkCardData } from '@/components/ds/ArtworkCard'
import { ArtworkId } from '@/components/ds/ArtworkId'
import { Icon } from '@/components/ds/Icon'
import { PriceBox } from '@/components/ds/PriceBox'
import { ProvenanceChain, type ProvenanceEvent } from '@/components/ds/ProvenanceChain'
import { StatusBadge, type ArtworkStatus } from '@/components/ds/StatusBadge'
import { ArtworkMedia } from './ArtworkMedia'
import { mediaItemsOf } from './artwork-media-core'
import { ArtworkOffer } from './ArtworkOffer'
import { ShippingQuote } from './ShippingQuote'
import { TalkToSellerButton } from './TalkToSellerButton'
import { ShareButton } from './ShareSheet'
import { CATEGORY_LANGUAGE, categoryLabel, CONDITION_GRADE_LABELS, formatBRL } from '@/lib/artworks/domain'
import type { MarketItem } from '@/lib/marketplace/filter-core'
import type { PublicArtworkPage } from '@/lib/marketplace/public-server'
import { installmentCents } from '@/lib/shipping/quote-core'
import { diaNoFuso } from '@/lib/timezone'

const LANGUAGE_OF: Partial<Record<string, Language>> = CATEGORY_LANGUAGE

function badgeOf(a: PublicArtworkPage): ArtworkStatus {
  if (a.status === 'STOLEN') return 'stolen'
  if (a.status === 'DISPUTED' || a.certificateStatus === 'CONTESTED') return 'contested'
  if (a.status === 'SOLD') return 'sold'
  if (a.certificateStatus === 'PENDING') return 'pending'
  return 'verified'
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
/** "2026-04" → "abril de 2026" (the history keeps YYYY-MM). */
function monthLong(ym: string): string {
  const [y, m] = ym.split('-')
  const i = Number(m) - 1
  return MONTHS[i] ? `${MONTHS[i]} de ${y}` : ym
}
const monthShort = (ym: string) => { const [y, m] = ym.split('-'); return m ? `${m}/${y}` : ym }
const dayBR = (iso: string) => { const d = diaNoFuso(iso); return d ? d.split('-').reverse().join('/') : '' }
const monthOfIso = (iso: string) => { const d = diaNoFuso(iso); return d ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : '' }

const EVENT_ICON: Record<string, string> = { CREATED: 'brush', CERTIFIED: 'verified', LISTED: 'storefront', TRANSFERRED: 'swap_horiz', LOANED: 'museum', RESTORED: 'build', STOLEN: 'gpp_bad', DISPUTED: 'report', INSURED: 'shield' }

/** The chain: certificate events (labels of lib/certificates/core) + exhibitions of the history, by date. */
function provenanceOf(a: PublicArtworkPage): ProvenanceEvent[] {
  const partyOf = (kind: string) => {
    switch (kind) {
      case 'CREATED': return a.artistProfile.livesIn ? `Ateliê de ${a.artist}, ${a.artistProfile.livesIn}` : `Ateliê de ${a.artist}`
      case 'CERTIFIED': return 'Assinatura digital · etiqueta vinculada'
      case 'LISTED': return a.seller.kind === 'GALLERY' ? `Consignada à ${a.seller.name}` : a.seller.name
      case 'TRANSFERRED': return 'Nova titularidade registrada'
      case 'STOLEN': return 'Ocorrência registrada na HouseArt'
      case 'DISPUTED': return 'Contestação em análise'
      default: return 'Registrado no certificado'
    }
  }
  const events = a.events.map((e) => ({ at: e.at, icon: EVENT_ICON[e.kind] ?? 'history', event: e.label, party: partyOf(e.kind), date: e.kind === 'CREATED' ? String(a.year ?? dayBR(e.at).slice(-4)) : e.kind === 'CERTIFIED' ? dayBR(e.at) : monthOfIso(e.at) }))
  const shows = a.history.filter((h) => h.kind === 'EXHIBITION').map((h) => ({ at: `${h.occurredOn}-15T12:00:00.000Z`, icon: 'museum', event: 'Exposta', party: h.description, date: monthShort(h.occurredOn) }))
  return [...events, ...shows].sort((x, y) => x.at.localeCompare(y.at)).map(({ icon, event, party, date }) => ({ icon, event, party, date }))
}

function cardOf(i: MarketItem): ArtworkCardData {
  return { href: `/e/artwork/${i.publicId}`, src: i.cover, artist: i.artist, title: i.title, year: i.year, technique: i.technique, dimensions: i.dimensions, price: i.priceCents === null ? 'Sob consulta' : formatBRL(i.priceCents), verified: true }
}

export function Artwork({ artwork: a, related, signedIn = false, counts = null }: { artwork: PublicArtworkPage; related: MarketItem[]; signedIn?: boolean; counts?: { likes: number; comments: number } | null }) {
  const language = LANGUAGE_OF[a.category]
  const media = mediaItemsOf(a.media)
  const wall = a.size.heightMm && a.size.widthMm ? { heightMm: a.size.heightMm, widthMm: a.size.widthMm, dimensions: a.dimensions } : null
  const price = a.priceCents === null ? null : Number(a.priceCents)
  const listed = a.status === 'LISTED'
  const sheet = [a.technique, [a.dimensions !== '—' ? a.dimensions : null, a.edition ?? 'obra única'].filter(Boolean).join(' · '), a.signatureLocation ? `Assinada ${a.signatureLocation}` : null].filter(Boolean)
  const spec: [string, string | null][] = [
    ['Técnica', a.technique], ['Materiais', a.materials], ['Dimensões', a.dimensions !== '—' ? a.dimensions : null], ['Edição', a.edition ?? 'Obra única'],
    ['Assinatura', a.signatureLocation], ['Série', a.series],
    ['Estado', a.conditionGrade ? `${CONDITION_GRADE_LABELS[a.conditionGrade as keyof typeof CONDITION_GRADE_LABELS] ?? a.conditionGrade}${a.conditionAt ? ` · condition report ${monthOfIso(a.conditionAt)}` : ''}` : null],
  ]
  const shows = a.history.filter((h) => h.kind === 'EXHIBITION')
  const others = a.history.filter((h) => h.kind !== 'EXHIBITION')
  const aboutLead = [a.technique, a.materials].filter(Boolean).join(', ')
  const about = aboutLead || shows.length || others.length
  const provenance = provenanceOf(a)
  const seller = a.seller
  const sellerMeta = [[seller.city, seller.uf].filter(Boolean).join('/') || null, seller.representsArtist ? 'representa a artista' : null].filter(Boolean).join(' · ')
  const sellerHref = seller.kind === 'GALLERY' && seller.slug ? `/e/gallery/${seller.slug}` : null
  const talkLabel = seller.kind === 'GALLERY' ? 'Falar com a galeria' : 'Falar com o vendedor'
  const p = a.artistProfile
  const artistMeta = [[p.birthPlace?.split('/')[0], p.birthYear].filter(Boolean).join(', ') || null, p.livesIn ? `vive e trabalha em ${p.livesIn.split('/')[0]}` : null].filter(Boolean).join(' · ')

  return (
    <div className="hp-container hp-artwork">
      <nav className="hp-artwork__crumbs" aria-label="Você está em">
        <Link href="/e/marketplace">Marketplace</Link><span>/</span>
        <Link href={`/e/marketplace?category=${a.category}`}>{categoryLabel(a.category)}</Link><span>/</span>
        <Link href={`/e/artist/${a.artistSlug}`}>{a.artist}</Link>
      </nav>

      <div className="hp-artwork__top">
        <div className="hp-artwork__gallery">
          <ArtworkMedia items={media} caption={{ artist: a.artist, title: a.title, year: a.year }} wall={wall} />
        </div>

        <aside className="hp-artwork__aside">
          <div className="hp-artwork__head">
            {language ? <Link href={`/e/marketplace?category=${a.category}`} aria-label={categoryLabel(a.category)} className="hp-artwork__mark"><LanguageMark language={language} height={56} /></Link> : null}
            <Link href={`/e/artist/${a.artistSlug}`} className="hp-artwork__artist">{a.artist}</Link>
            <h1 className="hp-artwork__title">{a.title}{a.year ? <>, <em>{a.year}</em></> : null}</h1>
            {sheet.length ? <div className="hp-artwork__sheet">{sheet.map((line, i) => <span key={i}>{i ? <br /> : null}{line}</span>)}</div> : null}
          </div>
          <div className="hp-artwork__badges">
            <StatusBadge status={badgeOf(a)} />
            <ArtworkId id={a.publicId} qr={false} />
            <Link href={`/verify/${a.publicId}`} className="hp-artwork__verify">Verificar certificado</Link>
            <ShareButton artwork={{ publicId: a.publicId, title: a.title, artist: a.artist, year: a.year, cover: a.cover, price: listed && price !== null ? formatBRL(price) : null }} className="hp-artwork__share" />
          </div>

          {a.status === 'STOLEN' ? (
            <div className="hp-artwork__notice"><b>Esta obra foi comunicada como roubada.</b> Ela não está à venda; qualquer oferta de negociação deve ser informada à HouseArt pela verificação do certificado.</div>
          ) : a.status === 'DISPUTED' ? (
            <div className="hp-artwork__notice"><b>A autenticidade ou a titularidade desta obra está contestada.</b> A venda fica suspensa até a análise da equipe HouseArt.</div>
          ) : a.status === 'SOLD' ? (
            <div className="hp-artwork__notice"><b>Obra vendida.</b> A escritura já foi transferida ao novo titular.</div>
          ) : a.status === 'IN_DEAL' ? (
            <div className="hp-artwork__notice"><b>Em negociação.</b> Há uma proposta aceita para esta obra; o anúncio volta se o negócio não se concluir.</div>
          ) : !listed ? (
            <div className="hp-artwork__notice"><b>Autenticada, não está à venda.</b> O titular ainda não publicou a obra no marketplace.</div>
          ) : (
            <div className="hp-artwork__price">
              <PriceBox value={price === null ? 'Sob consulta' : formatBRL(price)} note={price === null ? 'O preço não aparece: interessados pedem contato.' : `ou 10× de ${formatBRL(installmentCents(price))} sem juros no cartão`}>
                <ShippingQuote fromUf={seller.uf} size={a.size} priceCents={price} />
                {price !== null && a.acceptsOffers ? (
                  <ArtworkOffer publicId={a.publicId} priceCents={String(price)} fixedOnly={a.fixedPrice || a.saleMode === 'FIXED'} />
                ) : (
                  <TalkToSellerButton artworkId={a.id} publicId={a.publicId} signedIn={signedIn} label={talkLabel} className="ha-btn ha-btn--outline ha-btn--md hp-artwork__talk" />
                )}
                {counts && (counts.likes || counts.comments) ? (
                  <div className="hp-artwork__social" role="group" aria-label={`${counts.likes} curtidas e ${counts.comments} comentários`}>
                    <span><Icon name="favorite" size={16} />{counts.likes}</span>
                    <span><Icon name="chat_bubble" size={16} />{counts.comments}</span>
                  </div>
                ) : null}
                <div className="hp-artwork__assure">
                  <span><Icon name="lock" size={16} />Pagamento em garantia: liberado ao vendedor só depois que você confirma o recebimento.</span>
                  <span><Icon name="contract" size={16} />A escritura passa para o seu nome na entrega.</span>
                </div>
              </PriceBox>
            </div>
          )}

          <div className="hp-artwork__seller">
            <div className="hp-artwork__seller-head">
              <span className="ha-eyebrow">Vendido por</span>
              <span className="hp-artwork__kind"><Icon name={seller.kind === 'GALLERY' ? 'storefront' : 'person'} size={14} />{seller.kind === 'GALLERY' ? 'Galeria' : 'Particular'}</span>
            </div>
            <div className="hp-artwork__seller-row">
              <span className="hp-artwork__seller-avatar" aria-hidden="true">{seller.name.replace(/^Galeria\s+/i, '').charAt(0).toUpperCase()}</span>
              <div style={{ minWidth: 0 }}>
                {sellerHref ? <Link href={sellerHref} className="hp-artwork__seller-name">{seller.name}</Link> : <span className="hp-artwork__seller-name">{seller.name}</span>}
                {sellerMeta ? <div className="hp-artwork__seller-meta">{sellerMeta}</div> : null}
              </div>
              {a.status === 'SOLD' || a.status === 'STOLEN' ? null : <TalkToSellerButton artworkId={a.id} publicId={a.publicId} signedIn={signedIn} label={talkLabel} className="hp-artwork__seller-talk" />}
            </div>
          </div>
        </aside>
      </div>

      <section className="hp-artwork__info">
        {about ? (
          <div className="hp-artwork__col">
            <h2 className="hp-artwork__h2">Sobre a obra</h2>
            {aboutLead ? <p className="hp-artwork__lead">{aboutLead}{a.dimensions !== '—' ? `, ${a.dimensions}` : ''}{a.series ? `. Da série “${a.series}”` : ''}.</p> : null}
            {others.map((h, i) => <p key={`o${i}`} className="hp-artwork__note">{h.description} · {monthLong(h.occurredOn)}.</p>)}
            {shows.map((h, i) => <p key={`s${i}`} className="hp-artwork__note">Exposta em {h.description}, {monthLong(h.occurredOn)}.</p>)}
          </div>
        ) : null}
        <div className="hp-artwork__col">
          <h2 className="hp-artwork__h2">Ficha técnica</h2>
          <dl className="hp-artwork__spec">
            {spec.filter((r): r is [string, string] => !!r[1]).map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
        <div className="hp-artwork__col">
          <h2 className="hp-artwork__h2">Proveniência</h2>
          <div className="hp-artwork__prov">
            {provenance.length ? <ProvenanceChain events={provenance} /> : <p className="hp-artwork__note">O certificado ainda não registrou eventos.</p>}
            <Link href={`/verify/${a.publicId}`} className="hp-artwork__cert">Ver certificado público →</Link>
          </div>
        </div>
      </section>

      <section id="artista" className="hp-artwork__artist-band">
        <div className="hp-artwork__col">
          <div className="ha-eyebrow">Artista</div>
          <Link href={`/e/artist/${p.slug}`} className="hp-artwork__artist-name">{p.name}</Link>
          {artistMeta ? <div className="hp-artwork__artist-meta">{artistMeta}</div> : null}
        </div>
        <div className="hp-artwork__col">
          {p.bio ? <p className="hp-artwork__lead">{p.bio}</p> : null}
          <div className="hp-artwork__stats">
            <div><div className="hp-artwork__stat-n">{p.certifiedCount}</div><div className="hp-artwork__stat-l">{p.certifiedCount === 1 ? 'obra certificada' : 'obras certificadas'}</div></div>
            <div><div className="hp-artwork__stat-n">{p.forSaleCount}</div><div className="hp-artwork__stat-l">à venda</div></div>
            {p.exhibitionsCount ? <div><div className="hp-artwork__stat-n">{p.exhibitionsCount}</div><div className="hp-artwork__stat-l">{p.exhibitionsCount === 1 ? 'exposição' : 'exposições'}</div></div> : null}
          </div>
        </div>
      </section>

      {related.length ? (
        <section className="hp-artwork__related">
          <div className="hp-artwork__related-head">
            <h2 className="hp-artwork__h2">Mais desta artista e da galeria</h2>
            <Link href={`/e/artist/${a.artistSlug}`} className="hp-artwork__all">Ver todas</Link>
          </div>
          <ArtworkGrid items={related.map(cardOf)} />
        </section>
      ) : null}
    </div>
  )
}
