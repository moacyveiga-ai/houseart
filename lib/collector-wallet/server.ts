// Carteira de escrituras — the holder's artworks and the deed card.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { heldArtworks } from '@/lib/ownership/server'
import { ArtworkError } from '@/lib/artworks/server'

export interface WalletItem { artworkId: number; publicId: string | null; title: string; artist: string; acquiredAt: string; priceLabel: string; insured: boolean; insurer: string | null; holderName: string; holderMask: string | null; cover: string | null; version: number }

export async function walletOf(userId: number): Promise<{ items: WalletItem[]; totalCents: bigint }> {
  const rows = await heldArtworks(userId)
  const items: WalletItem[] = []
  let total = 0n
  for (const v of rows) {
    const a = v.certificate.artwork
    const transfer = await prisma.ownershipTransfer.findFirst({ where: { artworkId: a.id, status: 'COMPLETED', toUserId: userId }, orderBy: { completedAt: 'desc' } })
    const price = transfer?.priceSealed ? null : transfer?.priceCents ?? a.listPriceCents
    if (price) total += price
    const policy = a.insurancePolicies[0]
    items.push({ artworkId: a.id, publicId: a.publicId, title: `${a.title}${a.year ? `, ${a.year}` : ''}`, artist: a.artist.name, acquiredAt: v.issuedAt.toLocaleDateString('pt-BR'), priceLabel: transfer?.priceSealed ? 'Preço selado' : price ? Number(price / 100n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—', insured: !!policy, insurer: policy ? `${policy.insurer} · nº ${policy.policyNumber} · vigente` : null, holderName: v.holderName, holderMask: v.holderDocumentMask, cover: a.media[0]?.publicUrl ?? null, version: v.version })
  }
  return { items, totalCents: total }
}

/** "Segurar": a mock quotation becomes an ACTIVE collection policy (insurer provider is a J item). */
export async function insureArtwork(userId: number, artworkId: number) {
  const held = await prisma.certificateVersion.findFirst({ where: { holderUserId: userId, status: 'ACTIVE', certificate: { artworkId } } })
  if (!held) throw new ArtworkError('NOT_HOLDER', 'Você não é o titular desta obra.', 404)
  const a = await prisma.artwork.findUniqueOrThrow({ where: { id: artworkId }, select: { listPriceCents: true } })
  return prisma.insurancePolicy.create({ data: { artworkId, kind: 'COLLECTION', insurer: 'Chubb', policyNumber: `${Date.now().toString().slice(-5)}-${artworkId}`, validFrom: new Date(), validUntil: new Date(Date.now() + 365 * 86_400_000), coverageCents: a.listPriceCents ?? 0n } })
}
