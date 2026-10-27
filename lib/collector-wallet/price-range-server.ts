// "Faixa sugerida" — I/O: the completed sales of an artist in the last 12 months, across the house
// (total scope on purpose: the range is an aggregate and only shows with five sales or more).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { suggestedRange, rangeLine } from './price-range-core'

export async function artistPriceRange(artist: { id: number; name: string }, now = new Date()): Promise<string | null> {
  return totalScope('collector:price-range', async () => {
    const since = new Date(now.getTime() - 365 * 86_400_000)
    const deals = await prisma.deal.findMany({ where: { phase: 'COMPLETED', exceptionStatus: null, completedAt: { gte: since }, artwork: { artistId: artist.id } }, select: { amountCents: true }, orderBy: { completedAt: 'desc' }, take: 200 })
    const r = suggestedRange(deals.map((d) => d.amountCents))
    return r ? rangeLine(artist.name, r) : null
  })
}
