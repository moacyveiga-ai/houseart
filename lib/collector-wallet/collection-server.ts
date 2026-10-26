// "Minha coleção" (HouseArt Web Colecionador.dc.html › Coleção): the header the
// collector sees above Obras · Favoritos · Curtidos · Compras · Vendas — counts,
// registered value and artists. Every number comes from the same loaders the
// tabs use, so the header never disagrees with the list under it.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { walletOf } from './server'
import { favoritesOf } from '@/lib/community/server'
import { buyerDeals } from '@/lib/deals/server'
import { flagOn } from '@/lib/flags'

export interface CollectionSummary {
  works: number; registeredCents: bigint; artists: number
  saved: number; liked: number; purchases: number; newSales: number
}

export async function collectionSummary(user: { id: number; memberId: number | null }): Promise<CollectionSummary> {
  const [wallet, favs, deals, offers, newSales] = await Promise.all([
    walletOf(user.id),
    favoritesOf(user.id).catch(() => []),
    flagOn('FLAG_DEALS') ? buyerDeals(user.id).catch(() => []) : Promise.resolve([]),
    prisma.offer.count({ where: { buyerUserId: user.id, status: { in: ['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING'] } } }),
    user.memberId ? prisma.offer.count({ where: { memberId: user.memberId, status: { in: ['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING'] } } }) : Promise.resolve(0),
  ])
  return {
    works: wallet.items.length, registeredCents: wallet.totalCents, artists: new Set(wallet.items.map((i) => i.artist)).size,
    saved: favs.filter((f) => f.saved).length, liked: favs.filter((f) => f.liked).length,
    purchases: deals.filter((d) => d.phase !== 'COMPLETED').length + offers, newSales,
  }
}
