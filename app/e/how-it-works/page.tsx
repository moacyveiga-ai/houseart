import { Site, type SiteFeeGroup, type SiteHero, type SiteUser } from '@/components/public/Site'
import type { AudienceImage } from '@/components/public/SiteAudienceTabs'
import { marketItems, publicArtwork } from '@/lib/marketplace/public-server'
import { listPublicArtists, listPublicGalleries } from '@/lib/public-content/server'
import { listPublicPlans } from '@/lib/plans/server'
import { catalog } from '@/lib/orders/server'
import { formatBRL } from '@/lib/artworks/domain'
import { DEFAULT_PLATFORM_PRIMARY_BPS, DEFAULT_PLATFORM_SECONDARY_BUYER_BPS, DEFAULT_PLATFORM_SECONDARY_SELLER_BPS } from '@/lib/commission/split-core'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Como funciona — HouseArt' }

const pct = (bps: number) => `${bps / 100}%`

/** "Taxas avulsas": the service catalog grouped as in the prototype, plus the commission of the split rules. */
function feeGroups(services: { code: string; name: string; description: string | null; priceCents: bigint }[]): SiteFeeGroup[] {
  const by = new Map(services.map((s) => [s.code, s]))
  const row = (code: string, name: string, desc?: string) => {
    const s = by.get(code)
    if (!s || s.priceCents <= 0n) return null
    return { name, desc: desc ?? s.description ?? '', value: formatBRL(s.priceCents) }
  }
  const certification = [row('CERTIFICATION', 'Por obra', 'Artista, acima do limite do plano'), row('CERTIFICATION_BATCH', 'Em lote', 'Galeria, por obra')].filter((r) => r !== null)
  const services_ = [row('OFFPLATFORM_TRANSFER', 'Transferência externa', 'Venda feita fora da HouseArt'), row('APPRAISAL_SIGNED', 'Laudo de valor', 'Laudo assinado, com código de verificação')].filter((r) => r !== null)
  const commission = [
    { name: 'Mercado primário', desc: 'Primeira venda pelo artista ou galeria', value: pct(DEFAULT_PLATFORM_PRIMARY_BPS) },
    { name: 'Mercado secundário', desc: 'Revenda + direito de sequência ao artista', value: `${pct(DEFAULT_PLATFORM_SECONDARY_BUYER_BPS)} + ${pct(DEFAULT_PLATFORM_SECONDARY_SELLER_BPS)}` },
  ]
  return [
    { icon: 'verified', title: 'Certificação', items: certification },
    { icon: 'sell', title: 'Comissão sobre venda', items: commission },
    { icon: 'description', title: 'Serviços', items: services_ },
  ].filter((g) => g.items.length > 0)
}

export default async function HowItWorksPage() {
  const [items, plans, services, galleries, artists] = await Promise.all([marketItems(12), listPublicPlans(), catalog(), listPublicGalleries(), listPublicArtists(null, 12)])
  const withCover = items.filter((i) => i.cover)
  const first = withCover[0] ?? null
  const page = first ? await publicArtwork(first.publicId) : null
  const hero: SiteHero | null = first && first.cover ? { publicId: first.publicId, artist: first.artist, title: first.title, year: first.year, cover: first.cover, back: page?.media.find((m) => m.kind === 'BACK')?.url ?? null } : null
  // one wall image per audience tab: the three most recent listed works, each one at most once
  const audienceImages: (AudienceImage | null)[] = [0, 1, 2].map((i) => { const w = withCover[i % Math.max(1, withCover.length)]; return w?.cover ? { src: w.cover, alt: `${w.title}, de ${w.artist}` } : null })
  const users: SiteUser[] = [
    ...galleries.map((g) => ({ href: `/e/gallery/${g.slug}`, name: g.name, meta: `Galeria · ${g.city.includes('/') || !g.uf ? g.city : `${g.city}/${g.uf}`} · ${g.works} ${g.works === 1 ? 'obra autenticada' : 'obras autenticadas'}` })),
    ...artists.map((a) => ({ href: `/e/artist/${a.slug}`, name: a.name, meta: `Artista${a.meta ? ` · ${a.meta}` : ''} · ${a.count} ${a.count === 1 ? 'obra autenticada' : 'obras autenticadas'}` })),
  ]
  return <Site hero={hero} audienceImages={audienceImages} plans={plans} fees={feeGroups(services)} users={users} supportEmail={process.env.SUPPORT_EMAIL?.trim() || null} />
}
