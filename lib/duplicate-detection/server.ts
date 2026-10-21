// Duplicate check on the FRONT photo: compares the new pHash with the ones of
// every other artwork of the base (the check is cross-tenant on purpose — a
// stolen image registered by someone else must surface) and records the
// candidates ≥ threshold as DuplicateCheck PENDING. Runs in total scope: the
// query is of the whole base by design.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { DUPLICATE_THRESHOLD_BPS, similarityBps } from './phash-core'

export async function checkDuplicates(artworkId: number, pHash: string): Promise<{ id: number; candidateArtworkId: number; similarityBps: number }[]> {
  return totalScope('duplicate-detection', async () => {
    const others = await prisma.artworkMedia.findMany({
      where: { kind: 'FRONT_COLOR_CARD', pHash: { not: null }, artworkId: { not: artworkId }, artwork: { status: { notIn: ['ARCHIVED'] } } },
      select: { artworkId: true, pHash: true },
      take: 5000,
    })
    const hits = others
      .map((o) => ({ candidateArtworkId: o.artworkId, similarityBps: similarityBps(pHash, o.pHash!) }))
      .filter((h) => h.similarityBps >= DUPLICATE_THRESHOLD_BPS)
      .sort((a, b) => b.similarityBps - a.similarityBps)
      .slice(0, 5)
    const out: { id: number; candidateArtworkId: number; similarityBps: number }[] = []
    for (const h of hits) {
      const existing = await prisma.duplicateCheck.findFirst({ where: { artworkId, candidateArtworkId: h.candidateArtworkId } })
      const row = existing
        ? await prisma.duplicateCheck.update({ where: { id: existing.id }, data: { similarityBps: h.similarityBps } })
        : await prisma.duplicateCheck.create({ data: { artworkId, candidateArtworkId: h.candidateArtworkId, similarityBps: h.similarityBps } })
      out.push({ id: row.id, candidateArtworkId: row.candidateArtworkId, similarityBps: row.similarityBps })
    }
    return out
  })
}
