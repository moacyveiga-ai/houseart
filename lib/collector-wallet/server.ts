// Carteira de escrituras — the holder's artworks and the deed card.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { heldArtworks } from '@/lib/ownership/server'
import { ArtworkError } from '@/lib/artworks/server'
import { placeOrder } from '@/lib/orders/server'
import { recordEvent } from '@/lib/certificate-events/server'
import { audit } from '@/lib/audit'
import { restorationBlockReason, type RestorationInput } from './restore-core'

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
  // the annual premium is a mock quote (1 % of the registered value); the real insurer is a J item
  const premium = (a.listPriceCents ?? 0n) / 100n
  if (premium > 0n) await placeOrder({ serviceCode: 'COLLECTION_INSURANCE', payerKind: 'REQUESTER', userId, artworkId, amountCents: premium, description: 'Seguro de acervo · Chubb · 12 meses' })
  return prisma.insurancePolicy.create({ data: { artworkId, kind: 'COLLECTION', insurer: 'Chubb', policyNumber: `${Date.now().toString().slice(-5)}-${artworkId}`, validFrom: new Date(), validUntil: new Date(Date.now() + 365 * 86_400_000), coverageCents: a.listPriceCents ?? 0n } })
}

/**
 * "Registrar restauro": the holder writes a RESTORED event in the certificate's chain (what, who, when).
 * Nothing on the artwork changes — the record is the provenance line the public page and the panel show.
 */
export async function recordRestoration(userId: number, artworkId: number, input: RestorationInput, ctx: { ip?: string; userAgent?: string } = {}) {
  // The same rule as the collector's panel (holdsAsCollector): an active deed in the viewer's name
  // AND the work in their own COLLECTOR member — the issuing artist/gallery holds version 1 of a
  // listed work, but that is a seller's work, and the panel never offers the record to them.
  const held = await prisma.certificateVersion.findFirst({
    where: { holderUserId: userId, status: 'ACTIVE', certificate: { artworkId } },
    select: { certificate: { select: { status: true, artwork: { select: { status: true, member: { select: { userId: true, kind: true } } } } } } },
  })
  const m = held?.certificate.artwork.member
  if (!held || m?.kind !== 'COLLECTOR' || m.userId !== userId) throw new ArtworkError('NOT_HOLDER', 'Você não é o titular desta obra.', 404)
  const blocked = restorationBlockReason(held.certificate.artwork.status, held.certificate.status)
  if (blocked) throw new ArtworkError('RESTORATION_BLOCKED', blocked, 409)
  const ev = await recordEvent(artworkId, 'RESTORED', { description: input.description, restorer: input.restorer, on: input.on }, userId)
  void audit.event({ entity: 'artwork', entityId: artworkId, action: 'restoration', userId, ip: ctx.ip, userAgent: ctx.userAgent, after: { seq: ev.seq, restorer: input.restorer, on: input.on } })
  return { seq: ev.seq }
}
