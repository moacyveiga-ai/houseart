// "Faixa sugerida" — I/O: the completed sales of an artist in the last 12 months, across the house
// (total scope on purpose: the range is an aggregate and only shows with six sales or more, coarse on purpose).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { suggestedRange, rangeLine } from './price-range-core'

/** The amounts of the artist's completed sales in the last 12 months (the input of the range and of the collection valuation). */
export async function artistSaleAmounts(artistId: number, now = new Date()): Promise<bigint[]> {
  return totalScope('collector:price-range', async () => {
    const since = new Date(now.getTime() - 365 * 86_400_000)
    const deals = await prisma.deal.findMany({ where: { phase: 'COMPLETED', exceptionStatus: null, completedAt: { gte: since }, artwork: { artistId } }, select: { amountCents: true }, orderBy: { completedAt: 'desc' }, take: 200 })
    return deals.map((d) => d.amountCents)
  })
}

export async function artistPriceRange(artist: { id: number; name: string }, now = new Date()): Promise<string | null> {
  const r = suggestedRange(await artistSaleAmounts(artist.id, now))
  return r ? rangeLine(artist.name, r) : null
}
