// The artwork in the collector's side panel (handoff "HouseArt Web Colecionador" › obra): one view
// for a work on the market (price, seller, offer/buy) and for a work the viewer HOLDS (registered
// value, holder since, Serviços / Vender esta obra, the deed). Only display fields leave here —
// never the floor, hashes, the vault key nor another holder's document.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { publicArtwork } from '@/lib/marketplace/public-server'
import { artworkSignals } from '@/lib/community/server'
import { walletOf } from './server'
import { ARTWORK_CATEGORY_LABELS, formatBRL, formatDimensions } from '@/lib/artworks/domain'
import { EVENT_LABELS, type EventKind } from '@/lib/certificates/core'
import { flagOn } from '@/lib/flags'
import { isPublicId } from '@/lib/physical-markers/domain'
import type { CollectorPanelData } from './panel-core'

export type { CollectorPanelData }


const MEDIA_LABELS: Record<string, string> = { FRONT_COLOR_CARD: 'Frente', DETAIL: 'Detalhe', BACK: 'Verso' }
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'
const day = (d: Date | string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Bahia' })
const fichaOf = (year: number | null, technique: string | null, dims: string) => [year ? String(year) : null, technique, dims !== '—' ? dims : null].filter(Boolean).join(' · ')

/** A work the viewer holds (by its deed): `artworkId` must be in the viewer's wallet. */
async function ownerPanel(userId: number, artworkId: number): Promise<CollectorPanelData | null> {
  const w = (await walletOf(userId)).items.find((i) => i.artworkId === artworkId)
  if (!w) return null
  const a = await prisma.artwork.findUnique({
    where: { id: artworkId },
    select: { id: true, publicId: true, title: true, year: true, technique: true, heightMm: true, widthMm: true, depthMm: true, status: true, seal: true, listPriceCents: true, category: true,
      artist: { select: { name: true, slug: true } },
      media: { where: { kind: { in: ['FRONT_COLOR_CARD', 'DETAIL', 'BACK'] } }, orderBy: { sortOrder: 'asc' }, select: { kind: true, publicUrl: true } },
      certificate: { select: { issuedAt: true, status: true, events: { orderBy: { seq: 'asc' }, select: { kind: true, occurredAt: true } } } } },
  })
  if (!a) return null
  const listed = a.status === 'LISTED'
  const signals = a.publicId && a.seal === 'GREEN' ? await artworkSignals(userId, a.id) : null
  return {
    mode: 'owner', id: a.id, publicId: a.publicId, title: a.title, artist: a.artist.name, artistSlug: a.artist.slug,
    ficha: fichaOf(a.year, a.technique ?? ARTWORK_CATEGORY_LABELS[a.category as keyof typeof ARTWORK_CATEGORY_LABELS] ?? null, formatDimensions(a)),
    images: a.media.filter((m) => m.publicUrl).map((m) => ({ url: m.publicUrl!, label: MEDIA_LABELS[m.kind] ?? m.kind })),
    priceLabel: listed ? 'Seu preço pedido' : 'Valor registrado', price: listed && a.listPriceCents ? formatBRL(a.listPriceCents) : w.priceLabel,
    priceSub: `Titular desde ${w.acquiredAt}`, signals,
    certificate: { code: a.publicId, ok: a.seal === 'GREEN', text: a.seal === 'GREEN' ? `Etiqueta NFC no verso, assinada por ${a.artist.name} digitalmente. A escritura está em seu nome.` : 'Certificado em revisão. A escritura segue em seu nome.' },
    provenance: [
      ...(a.certificate?.events ?? []).map((e) => ({ k: EVENT_LABELS[e.kind as EventKind] ?? e.kind, v: day(e.occurredAt) })),
      { k: 'Titular atual · você', v: `Desde ${w.acquiredAt}` },
    ],
    seller: null, market: null,
    owner: { status: a.status, sealGreen: a.seal === 'GREEN', registeredCents: a.listPriceCents?.toString() ?? null, insured: w.insured, insurer: w.insurer, holderName: w.holderName, holderMask: w.holderMask, acquiredAt: w.acquiredAt, version: w.version, transferOn: flagOn('FLAG_OWNERSHIP_TRANSFER'), cover: w.cover },
  }
}

/** A public work (green seal): what the marketplace page shows, in the panel. */
async function marketPanel(viewer: number, publicId: string): Promise<CollectorPanelData | null> {
  const p = await publicArtwork(publicId)
  if (!p) return null
  const listed = p.status === 'LISTED'
  const signals = await artworkSignals(viewer, p.id)
  const place = [p.seller.city, p.seller.uf].filter(Boolean).join(', ')
  return {
    mode: 'market', id: p.id, publicId: p.publicId, title: p.title, artist: p.artist, artistSlug: p.artistSlug,
    ficha: fichaOf(p.year, p.technique, p.dimensions),
    images: p.media.map((m) => ({ url: m.url, label: MEDIA_LABELS[m.kind] ?? m.kind })),
    priceLabel: !listed ? (p.status === 'IN_DEAL' ? 'Reservada' : 'Fora de venda') : p.priceCents === null ? 'Preço sob consulta' : p.fixedPrice ? 'Preço fixo' : 'Preço pedido · aceita ofertas',
    price: listed && p.priceCents !== null ? formatBRL(p.priceCents) : '—',
    priceSub: listed && p.priceCents !== null ? `ou 10× de ${formatBRL(p.priceCents / 10n)} sem juros` : '',
    signals,
    certificate: { code: p.publicId, ok: p.certificateStatus === 'ACTIVE', text: p.certificateStatus === 'ACTIVE' ? `Etiqueta NFC no verso, assinada por ${p.artist} digitalmente. A escritura passa para o seu nome no toque da entrega.` : p.certificateStatus === 'CONTESTED' ? 'Certificado contestado: a equipe da HouseArt está analisando.' : 'Certificado indisponível.' },
    provenance: [...p.events.map((e) => ({ k: e.label, v: day(e.at) })), { k: 'Titular atual', v: p.seller.kind === 'GALLERY' ? `${p.seller.name}${p.seller.representsArtist ? ' · consignação do artista' : ''}` : 'Colecionador verificado' }],
    seller: { name: p.seller.name, initials: initials(p.seller.name), sub: [p.seller.kind === 'GALLERY' ? 'Galeria' : 'Colecionador', place].filter(Boolean).join(' · ') },
    market: { acceptsOffers: listed && p.acceptsOffers && !p.fixedPrice, buyable: listed && p.priceCents !== null, reserved: p.status === 'IN_DEAL' },
    owner: null,
  }
}

/** The panel named by the page's query: `own=<artworkId>` (a deed of the viewer) or `work=<publicId>`. A public
 *  work the viewer holds opens in the owner view. */
export async function collectorPanel(userId: number, q: { work?: string; own?: string }): Promise<CollectorPanelData | null> {
  const own = Number(q.own)
  if (Number.isInteger(own) && own > 0) return ownerPanel(userId, own)
  const work = typeof q.work === 'string' && isPublicId(q.work) ? q.work : null
  if (!work) return null
  const mine = (await walletOf(userId)).items.find((i) => i.publicId === work)
  return mine ? ownerPanel(userId, mine.artworkId) : marketPanel(userId, work)
}
