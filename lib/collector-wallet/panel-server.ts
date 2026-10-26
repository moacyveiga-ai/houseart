// The artwork in the collector's side panel (handoff "HouseArt Web Colecionador" › obra): one view
// for a work on the market (price, seller, offer/buy) and for a work the viewer HOLDS (registered
// value, holder since, Serviços / Vender esta obra, the deed). Only display fields leave here —
// never the floor, hashes, the vault key nor another holder's document.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { publicArtwork } from '@/lib/marketplace/public-server'
import { artworkSignals } from '@/lib/community/server'
import { walletOf } from './server'
import { categoryLabel, formatBRL, formatDimensions } from '@/lib/artworks/domain'
import { EVENT_LABELS, type EventKind } from '@/lib/certificates/core'
import { flagOn } from '@/lib/flags'
import { payoutReadiness } from '@/lib/payment-methods/payout-readiness-server'
import { cpfMaskOf } from '@/lib/payment-methods/domain'
import { isPublicId } from '@/lib/physical-markers/domain'
import type { CollectorPanelData } from './panel-core'

export type { CollectorPanelData }


const MEDIA_LABELS: Record<string, string> = { FRONT_COLOR_CARD: 'Frente', DETAIL: 'Detalhe', BACK: 'Verso' }
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'
const day = (d: Date | string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Bahia' })
/** Frente, Detalhe, Verso — the viewer's order in the prototype, whatever the upload order. */
const byView = <T extends { kind: string }>(m: T[]) => [...m].sort((x, y) => VIEW_ORDER.indexOf(x.kind) - VIEW_ORDER.indexOf(y.kind))
const VIEW_ORDER = ['FRONT_COLOR_CARD', 'DETAIL', 'BACK']
const fichaOf = (year: number | null, technique: string | null, dims: string) => [year ? String(year) : null, technique, dims !== '—' ? dims : null].filter(Boolean).join(' · ')

/** The viewer HOLDS the work as a collector: an active deed in their name and the work in their own
 *  COLLECTOR member. (The issuing artist/gallery also holds version 1 of its certificates — that is a
 *  seller's work, not a collection item, so it opens in the market view.) */
async function holdsAsCollector(userId: number, where: { artworkId: number } | { publicId: string }): Promise<number | null> {
  const v = await prisma.certificateVersion.findFirst({
    where: { holderUserId: userId, status: 'ACTIVE', certificate: 'artworkId' in where ? { artworkId: where.artworkId } : { publicId: where.publicId } },
    select: { certificate: { select: { artworkId: true, artwork: { select: { member: { select: { userId: true, kind: true } } } } } } },
  })
  const m = v?.certificate.artwork.member
  return v && m?.kind === 'COLLECTOR' && m.userId === userId ? v.certificate.artworkId : null
}

/** A work the viewer holds (by its deed): `artworkId` must be in the viewer's wallet. */
async function ownerPanel(viewer: { id: number; name: string; cpf: string | null }, artworkId: number): Promise<CollectorPanelData | null> {
  const userId = viewer.id
  const w = (await walletOf(userId)).items.find((i) => i.artworkId === artworkId)
  if (!w) return null
  const a = await prisma.artwork.findUnique({
    where: { id: artworkId },
    select: { id: true, publicId: true, title: true, year: true, technique: true, heightMm: true, widthMm: true, depthMm: true, status: true, seal: true, listPriceCents: true, category: true, memberId: true,
      artist: { select: { name: true, slug: true } },
      media: { where: { kind: { in: ['FRONT_COLOR_CARD', 'DETAIL', 'BACK'] } }, orderBy: { sortOrder: 'asc' }, select: { kind: true, publicUrl: true } },
      certificate: { select: { issuedAt: true, status: true, events: { orderBy: { seq: 'asc' }, select: { kind: true, occurredAt: true } } } } },
  })
  if (!a) return null
  const listed = a.status === 'LISTED'
  const signals = a.publicId && a.seal === 'GREEN' ? await artworkSignals(userId, a.id) : null
  // "Publicar sem Pix abre o cadastro de Pix": the work is in the viewer's own COLLECTOR member (holdsAsCollector)
  // the same name and mask the Pix screen shows (the key is checked against the SESSION's CPF, never the deed's)
  const payout = { ready: (await payoutReadiness(a.memberId)).ready, holderName: viewer.name, cpfMask: cpfMaskOf(viewer.cpf) }
  return {
    mode: 'owner', id: a.id, publicId: a.publicId, title: a.title, artist: a.artist.name, artistSlug: a.artist.slug,
    ficha: fichaOf(a.year, a.technique ?? (categoryLabel(a.category) || null), formatDimensions(a)),
    images: byView(a.media.filter((m) => m.publicUrl)).map((m) => ({ url: m.publicUrl!, label: MEDIA_LABELS[m.kind] ?? m.kind })),
    priceLabel: listed ? 'Seu preço pedido' : 'Valor registrado', price: listed && a.listPriceCents ? formatBRL(a.listPriceCents) : w.priceLabel,
    priceSub: `Titular desde ${w.acquiredAt}`, signals,
    certificate: { code: a.publicId, ok: a.seal === 'GREEN', text: a.seal === 'GREEN' ? `Etiqueta NFC no verso, assinada por ${a.artist.name} digitalmente. A escritura está em seu nome.` : 'Certificado em revisão. A escritura segue em seu nome.' },
    provenance: [
      ...(a.certificate?.events ?? []).map((e) => ({ k: EVENT_LABELS[e.kind as EventKind] ?? e.kind, v: day(e.occurredAt) })),
      { k: 'Titular atual · você', v: `Desde ${w.acquiredAt}` },
    ],
    seller: null, market: null,
    owner: { status: a.status, sealGreen: a.seal === 'GREEN', registeredCents: a.listPriceCents?.toString() ?? null, insured: w.insured, insurer: w.insurer, holderName: w.holderName, holderMask: w.holderMask, acquiredAt: w.acquiredAt, version: w.version, transferOn: flagOn('FLAG_OWNERSHIP_TRANSFER'), payout, cover: w.cover },
  }
}

/** A public work: what the marketplace page shows, in the panel. Stolen / disputed works keep a public
 *  page — the panel says so and offers nothing. The viewer's own listing (or their gallery's) has no
 *  buy / offer / conversation. */
async function marketPanel(viewer: { id: number; tenantId: number | null }, publicId: string): Promise<CollectorPanelData | null> {
  const p = await publicArtwork(publicId)
  if (!p) return null
  const seller = await prisma.artwork.findUnique({ where: { publicId }, select: { member: { select: { userId: true, tenantId: true } } } })
  const mine = !!seller && (seller.member.userId === viewer.id || (viewer.tenantId !== null && seller.member.tenantId === viewer.tenantId))
  const blocked = p.status === 'STOLEN' || p.status === 'DISPUTED'
  const listed = p.status === 'LISTED' && !mine
  const signals = blocked ? null : await artworkSignals(viewer.id, p.id)
  const place = [p.seller.city, p.seller.uf].filter(Boolean).join(', ')
  return {
    mode: 'market', id: p.id, publicId: p.publicId, title: p.title, artist: p.artist, artistSlug: p.artistSlug,
    ficha: fichaOf(p.year, p.technique, p.dimensions),
    images: byView(p.media).map((m) => ({ url: m.url, label: MEDIA_LABELS[m.kind] ?? m.kind })),
    priceLabel: blocked ? 'Fora de venda' : mine && p.status === 'LISTED' ? 'Seu preço pedido' : !listed ? (p.status === 'IN_DEAL' ? 'Reservada' : 'Fora de venda') : p.priceCents === null ? 'Preço sob consulta' : p.fixedPrice ? 'Preço fixo' : 'Preço pedido · aceita ofertas',
    price: (listed || (mine && p.status === 'LISTED')) && p.priceCents !== null ? formatBRL(p.priceCents) : '—',
    priceSub: listed && p.priceCents !== null ? `ou 10× de ${formatBRL(p.priceCents / 10n)} sem juros` : '',
    signals,
    certificate: blocked ? { code: p.publicId, ok: false, text: p.status === 'STOLEN' ? 'Obra registrada como roubada. Não negocie esta obra; se tiver informação, fale com a HouseArt.' : 'Titularidade em disputa: a equipe da HouseArt está analisando. A obra não pode ser negociada agora.' }
      : { code: p.publicId, ok: p.certificateStatus === 'ACTIVE', text: p.certificateStatus === 'ACTIVE' ? `Etiqueta NFC no verso, assinada por ${p.artist} digitalmente. A escritura passa para o seu nome no toque da entrega.` : p.certificateStatus === 'CONTESTED' ? 'Certificado contestado: a equipe da HouseArt está analisando.' : 'Certificado indisponível.' },
    provenance: [...p.events.map((e) => ({ k: e.label, v: day(e.at) })), { k: 'Titular atual', v: p.seller.kind === 'GALLERY' ? `${p.seller.name}${p.seller.representsArtist ? ' · consignação do artista' : ''}` : 'Colecionador verificado' }],
    seller: mine || blocked ? null : { name: p.seller.name, initials: initials(p.seller.name), sub: [p.seller.kind === 'GALLERY' ? 'Galeria' : 'Colecionador', place].filter(Boolean).join(' · ') },
    market: blocked || mine ? null : { acceptsOffers: listed && p.acceptsOffers && !p.fixedPrice, buyable: listed && p.priceCents !== null, reserved: p.status === 'IN_DEAL' },
    owner: null,
  }
}

/** The panel named by the page's query: `own=<artworkId>` (a deed of the viewer) or `work=<publicId>`. A public
 *  work the viewer holds opens in the owner view. */
export async function collectorPanel(viewer: { id: number; name: string; cpf: string | null; tenantId: number | null }, q: { work?: string; own?: string }): Promise<CollectorPanelData | null> {
  const own = Number(q.own)
  if (Number.isInteger(own) && own > 0) {
    if (await holdsAsCollector(viewer.id, { artworkId: own })) return ownerPanel(viewer, own)
    const pub = await prisma.artwork.findUnique({ where: { id: own }, select: { publicId: true } })
    return pub?.publicId ? marketPanel(viewer, pub.publicId) : null
  }
  const work = typeof q.work === 'string' && isPublicId(q.work) ? q.work : null
  if (!work) return null
  const held = await holdsAsCollector(viewer.id, { publicId: work })
  return held ? ownerPanel(viewer, held) : marketPanel(viewer, work)
}
