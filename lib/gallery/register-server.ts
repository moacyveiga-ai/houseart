// Cadastrar obra da galeria — I/O. The draft is born with the origin ("De onde vem esta obra?") and
// the artist: one of the gallery's (by id), a public artist of the house (by id), or a name that is
// not anywhere yet (an Artist row of the tenant, no contract — Artistas representados adds one).
// The photos, the sheet and the review go through the artwork routes the wizard already uses.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { memberOfScope, tenantOfScope, type Scope } from '@/lib/scope/core'
import { ArtworkError, createDraft, getArtwork, patchArtwork } from '@/lib/artworks/server'
import { GALLERY_SOURCE_KINDS, type GallerySourceKind } from '@/lib/artworks/domain'
import { uniqueSlug } from '@/lib/tenant/slug'

export interface RegisterGalleryArtworkInput { sourceKind: GallerySourceKind; artistId?: number | null; artistName?: string | null }

/** Who may register here: a member of a gallery (staff) or an advisor — never a collector (their door is /wallet/register). */
async function requireGalleryMember(scope: Scope): Promise<{ memberId: number; tenantId: number }> {
  const memberId = memberOfScope(scope)
  const tenantId = tenantOfScope(scope)
  if (!memberId || !tenantId) throw new ArtworkError('NO_MEMBER', 'Só a equipe de uma galeria cadastra obras aqui.', 403)
  const m = await prisma.member.findUnique({ where: { id: memberId }, select: { kind: true, status: true } })
  if (!m || m.status !== 'ACTIVE' || (m.kind !== 'GALLERY_STAFF' && m.kind !== 'ADVISOR')) throw new ArtworkError('NOT_GALLERY', 'Só a equipe de uma galeria cadastra obras aqui.', 403)
  return { memberId, tenantId }
}

export async function registerGalleryArtwork(scope: Scope, i: RegisterGalleryArtworkInput): Promise<{ id: number }> {
  if (!GALLERY_SOURCE_KINDS.includes(i.sourceKind)) throw new ArtworkError('BAD_ORIGIN', 'Diga de onde vem esta obra.', 422)
  const { tenantId } = await requireGalleryMember(scope)
  let artistId = i.artistId ?? null
  const name = i.artistName?.replace(/\s+/g, ' ').trim() ?? ''
  if (artistId) {
    // one of the gallery's own (the same reach createDraft enforces): a gallery sells only artists it represents
    const a = await prisma.artist.findFirst({ where: { id: artistId, OR: [{ tenantId }, { member: { tenantId } }] }, select: { id: true } })
    if (!a) throw new ArtworkError('ARTIST_NOT_REACHABLE', 'Artista fora da sua galeria. Cadastre em Artistas representados.', 404)
  } else {
    if (name.length < 2) throw new ArtworkError('NO_ARTIST', 'Informe o artista da obra.', 422)
    // the gallery's own artist of that name, else a new one of the tenant (no contract yet)
    const found = await prisma.artist.findFirst({ where: { tenantId, name: { equals: name, mode: 'insensitive' } }, select: { id: true }, orderBy: { id: 'asc' } })
    artistId = found?.id ?? (await prisma.artist.create({ data: { tenantId, name, slug: await uniqueSlug(name, async (s) => !!(await prisma.artist.findUnique({ where: { slug: s }, select: { id: true } }))) } })).id
  }
  const a = await createDraft(scope, { artistId })
  await patchArtwork(scope, a.id, { acquisitionKind: i.sourceKind })
  return { id: a.id }
}

export interface GalleryRegisterDraft {
  id: number; acquisitionKind: string; artistName: string; title: string; year: number | null
  technique: string | null; materials: string | null; heightMm: number | null; widthMm: number | null; depthMm: number | null
  edition: string | null; signatureLocation: string | null; conditionGrade: string | null; description: string | null
  acquisitionYear: number | null; acquisitionFrom: string | null; acquisitionNote: string | null; acquisitionPriceCents: string | null
  media: { kind: string; publicUrl: string | null; quality: string | null }[]
  completed: boolean
}

/** A draft of the gallery's register the person resumes (/artworks/register?draft=<id>): in reach, still DRAFT, born here. */
export async function galleryRegisterDraft(scope: Scope, artworkId: number): Promise<GalleryRegisterDraft | null> {
  await requireGalleryMember(scope)
  const a = await getArtwork(scope, artworkId).catch((e) => { if (e instanceof ArtworkError && e.status === 404) return null; throw e })
  if (!a || a.status !== 'DRAFT' || !a.acquisitionKind || !(GALLERY_SOURCE_KINDS as readonly string[]).includes(a.acquisitionKind)) return null
  return {
    id: a.id, acquisitionKind: a.acquisitionKind, artistName: a.artist.name, title: a.title === 'Nova obra' ? '' : a.title,
    year: a.year, technique: a.technique, materials: a.materials, heightMm: a.heightMm, widthMm: a.widthMm, depthMm: a.depthMm,
    edition: a.edition, signatureLocation: a.signatureLocation, conditionGrade: a.conditionGrade, description: a.description,
    acquisitionYear: a.acquisitionYear, acquisitionFrom: a.acquisitionFrom, acquisitionNote: a.acquisitionNote,
    acquisitionPriceCents: a.acquisitionPriceCents === null ? null : a.acquisitionPriceCents.toString(),
    media: a.media.map((m) => ({ kind: m.kind, publicUrl: m.publicUrl, quality: m.quality })),
    completed: a.wizardStep >= 5,
  }
}
