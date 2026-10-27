// Admin › Obras e certificados › Todas as obras — I/O. Read-only, total scope on purpose: the desk
// sees every work of the house in any state. Never the floor, the document hash or the vault keys.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import type { Prisma } from '@/app/generated/prisma/client'
import { ALERT_CERTIFICATE_STATUSES, FILTER_STATUSES, PAGE_SIZE, pageOf, parseQuery, type ArtworkFilter } from './core'

export interface AdminArtworkRow {
  id: number; title: string; year: number | null; publicId: string | null; status: string; seal: string; createdAt: string
  artist: string; account: string | null; cover: string | null
  certificate: { status: string; signedAt: string | null; issuedAt: string | null; versions: { version: number; status: string; issuedAt: string }[] } | null
  openReviews: number
}

function whereOf(f: ArtworkFilter, q: ReturnType<typeof parseQuery>): Prisma.ArtworkWhereInput {
  const and: Prisma.ArtworkWhereInput[] = []
  const statuses = FILTER_STATUSES[f]
  if (f === 'alert') and.push({ OR: [{ status: { in: [...statuses!] } }, { certificate: { status: { in: [...ALERT_CERTIFICATE_STATUSES] } } }] })
  else if (statuses) and.push({ status: { in: [...statuses] } })
  if (q.id !== null) and.push({ id: q.id })
  if (q.publicId) and.push({ publicId: { contains: q.publicId, mode: 'insensitive' } })
  if (q.text) and.push({ OR: [{ title: { contains: q.text, mode: 'insensitive' } }, { artist: { name: { contains: q.text, mode: 'insensitive' } } }, { member: { displayName: { contains: q.text, mode: 'insensitive' } } }] })
  return and.length ? { AND: and } : {}
}

export async function adminArtworks(opt: { q?: string; f: ArtworkFilter; page?: string }) {
  return totalScope('admin:artworks', async () => {
    const q = parseQuery(opt.q)
    const where = whereOf(opt.f, q)
    const [total, byStatus, alert] = await Promise.all([
      prisma.artwork.count({ where }),
      prisma.artwork.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.artwork.count({ where: whereOf('alert', parseQuery('')) }),
    ])
    const { page, pages } = pageOf(opt.page, total)
    const rows = await prisma.artwork.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: {
        id: true, title: true, year: true, publicId: true, status: true, seal: true, createdAt: true,
        artist: { select: { name: true } }, member: { select: { displayName: true } },
        media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 },
        certificate: { select: { status: true, signedAt: true, issuedAt: true, versions: { select: { version: true, status: true, issuedAt: true }, orderBy: { version: 'desc' } } } },
      },
    })
    const open = rows.length ? await prisma.reviewQueueItem.groupBy({ by: ['artworkId'], where: { status: 'OPEN', artworkId: { in: rows.map((r) => r.id) } }, _count: { _all: true } }) : []
    const openBy = new Map(open.map((o) => [o.artworkId, o._count._all]))
    const count = (s: string[]) => byStatus.filter((b) => s.includes(b.status)).reduce((a, b) => a + b._count._all, 0)
    return {
      page, pages, total,
      kpis: {
        all: count(byStatus.map((b) => b.status)),
        certification: count(['IN_CERTIFICATION']),
        certified: count(['AUTHENTICATED', 'LISTED', 'IN_DEAL', 'SOLD']),
        // the same union as the "Com alerta" chip: a stolen work with a revoked certificate counts once
        alert,
      },
      rows: rows.map((r): AdminArtworkRow => ({
        id: r.id, title: r.title, year: r.year, publicId: r.publicId, status: r.status, seal: r.seal, createdAt: r.createdAt.toISOString(),
        artist: r.artist.name, account: r.member?.displayName ?? null, cover: r.media[0]?.publicUrl ?? null,
        certificate: r.certificate ? {
          status: r.certificate.status, signedAt: r.certificate.signedAt?.toISOString() ?? null, issuedAt: r.certificate.issuedAt?.toISOString() ?? null,
          versions: r.certificate.versions.map((v) => ({ version: v.version, status: v.status, issuedAt: v.issuedAt.toISOString() })),
        } : null,
        openReviews: openBy.get(r.id) ?? 0,
      })),
    }
  })
}
