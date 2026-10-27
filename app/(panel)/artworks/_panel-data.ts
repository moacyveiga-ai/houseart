// The display fields of one artwork for the gallery's side panel (Acervo › obra) and the
// "Gestão do anúncio" page: photos, ficha, price and status, certificate and provenance. Never
// hashes, the vault key nor the floor.
import 'server-only'
import type { getArtwork } from '@/lib/artworks/server'
import { categoryLabel, formatDimensions, MEDIA_SLOTS, type ArtworkStatus } from '@/lib/artworks/domain'
import { publicCertificate } from '@/lib/certificates/server'
import { rowPrice, rowStatus } from '@/components/gallery/inventory-core'
import type { ArtworkPanelData } from '@/components/gallery/ArtworkPanel'

type Artwork = NonNullable<Awaited<ReturnType<typeof getArtwork>>>

export async function artworkPanelData(a: Artwork, listing: { paused: boolean } | null): Promise<ArtworkPanelData> {
  const cert = a.publicId ? await publicCertificate(a.publicId) : null
  const slotName = new Map(MEDIA_SLOTS.map((s) => [s.kind, s.name]))
  const front = a.media.filter((m) => m.publicUrl).sort((x, y) => (x.kind === 'FRONT_COLOR_CARD' ? -1 : y.kind === 'FRONT_COLOR_CARD' ? 1 : 0))
  const st = rowStatus({ status: a.status as ArtworkStatus, listing: listing ? { views7d: 0, openOffers: 0, paused: listing.paused } : null })
  return {
    id: a.id, title: a.title, year: a.year, artist: a.artist.name, publicId: a.publicId, status: a.status, statusLabel: st.label, statusTone: st.tone,
    price: rowPrice({ saleMode: a.saleMode, listPriceCents: a.listPriceCents?.toString() ?? null }),
    images: front.map((m) => ({ url: m.publicUrl!, label: slotName.get(m.kind as never) ?? m.kind })),
    facts: [
      ['Técnica', [categoryLabel(a.category), a.technique, a.materials].filter(Boolean).join(' · ')], ['Dimensões', formatDimensions(a)],
      ['Edição', a.edition ?? ''], ['ID público', a.publicId ?? ''],
    ].filter(([, v]) => v && v !== '—').map(([k, v]) => ({ k: k!, v: v! })),
    certificate: cert ? { issuedAt: cert.issuedAt, status: cert.status } : null,
    provenance: (cert?.events ?? []).map((e) => ({ label: e.label, at: e.at })),
  }
}
