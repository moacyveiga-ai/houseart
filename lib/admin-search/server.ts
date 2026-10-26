// Admin › Busca com escopo total — I/O: artworks in any status (title, artist, owner, public id,
// `#id`), deals by code or artwork, accounts by name, e-mail or `#id`. Team only (the page checks);
// every query inside totalScope. Nothing of the mandate (floor) and no document ever leaves here.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { ARTWORK_STATUS_LABELS, type ArtworkStatus } from '@/lib/artworks/domain'
import { PHASE_LABELS, isPhase } from '@/lib/admin-deals/core'
import { LOGIN_PROFILE_LABELS } from '@/lib/admin-users/core'
import { normalizeQuery } from '@/lib/search/core'
import { ADMIN_SEARCH_TAKE, canonicalDealCode, canonicalPublicId, EMPTY, idOf, termKindOf, type AdminSearchResult } from './core'

const ci = (s: string) => ({ contains: s, mode: 'insensitive' as const })

export async function adminSearch(raw: string | null | undefined): Promise<AdminSearchResult> {
  const q = normalizeQuery(raw)
  if (!q) return EMPTY
  return totalScope('admin:search', async () => {
    const kind = termKindOf(q)
    const id = idOf(q)
    const publicId = canonicalPublicId(q)
    const dealCode = canonicalDealCode(q)
    const artworkWhere = kind === 'certificate' ? { OR: [{ publicId }, { certificate: { publicId } }] }
      : kind === 'id' ? { id: id as number }
      : kind === 'deal' || kind === 'email' ? null
      : { OR: [{ title: ci(q) }, { artist: { name: ci(q) } }, { member: { displayName: ci(q) } }, { publicId: ci(q) }] }
    const dealWhere = kind === 'deal' ? { code: dealCode as string }
      : kind === 'id' ? { id: id as number }
      : kind === 'text' ? { OR: [{ code: ci(q) }, { artwork: { title: ci(q) } }] }
      : null
    const userWhere = kind === 'id' ? { id: id as number }
      : kind === 'email' ? { email: ci(q) }
      : kind === 'text' ? { OR: [{ name: ci(q) }, { email: ci(q) }] }
      : null
    const [artworks, deals, users] = await Promise.all([
      artworkWhere ? prisma.artwork.findMany({ where: artworkWhere, take: ADMIN_SEARCH_TAKE, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, status: true, publicId: true, artist: { select: { name: true } }, member: { select: { displayName: true } }, certificate: { select: { publicId: true, status: true } }, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } } }) : [],
      dealWhere ? prisma.deal.findMany({ where: dealWhere, take: ADMIN_SEARCH_TAKE, orderBy: { id: 'desc' }, select: { id: true, code: true, phase: true, exceptionStatus: true, buyerUserId: true, sellerMemberId: true, artwork: { select: { title: true } } } }) : [],
      userWhere ? prisma.user.findMany({ where: userWhere, take: ADMIN_SEARCH_TAKE, orderBy: { id: 'desc' }, select: { id: true, name: true, email: true, profile: true, active: true, member: { select: { displayName: true } } } }) : [],
    ])
    // the seller is the deal's own member: after the transfer the artwork belongs to the buyer
    const [buyers, sellers] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: deals.map((d) => d.buyerUserId) } }, select: { id: true, name: true } }).then((xs) => new Map(xs.map((u) => [u.id, u.name]))),
      prisma.member.findMany({ where: { id: { in: deals.map((d) => d.sellerMemberId) } }, select: { id: true, displayName: true } }).then((xs) => new Map(xs.map((m) => [m.id, m.displayName]))),
    ])
    const result: AdminSearchResult = {
      q,
      artworks: artworks.map((a) => {
        const pid = a.certificate?.publicId ?? a.publicId
        return { id: a.id, title: a.title, artist: a.artist.name, owner: a.member.displayName, status: a.status, statusLabel: ARTWORK_STATUS_LABELS[a.status as ArtworkStatus] ?? a.status, publicId: pid, certificateStatus: a.certificate?.status ?? null, cover: a.media[0]?.publicUrl ?? null, href: `/artworks/${a.id}/edit`, verifyHref: pid ? `/verify/${encodeURIComponent(pid)}` : null }
      }),
      deals: deals.map((d) => ({ id: d.id, code: d.code, phase: d.phase, phaseLabel: isPhase(d.phase) ? PHASE_LABELS[d.phase] : d.phase, exception: d.exceptionStatus, artworkTitle: d.artwork.title, seller: sellers.get(d.sellerMemberId) ?? `membro #${d.sellerMemberId}`, buyer: buyers.get(d.buyerUserId) ?? `conta #${d.buyerUserId}`, href: `/admin/deals?f=all&deal=${d.id}` })),
      users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, profile: u.profile, profileLabel: LOGIN_PROFILE_LABELS[u.profile] ?? u.profile, active: u.active, member: u.member?.displayName ?? null, href: `/admin/users?q=%23${u.id}` })),
      total: 0,
    }
    result.total = result.artworks.length + result.deals.length + result.users.length
    return result
  })
}
