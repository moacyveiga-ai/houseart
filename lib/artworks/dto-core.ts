// What an artwork looks like to a client (web island or mobile app): the row of
// getArtwork without the private-vault key, the content hashes and the owner of
// a look-alike work found by the duplicate check. Pure.

interface MediaRow { masterRef?: unknown; sha256?: unknown; pHash?: unknown; [k: string]: unknown }
interface DuplicateRow { candidate?: { memberId?: unknown; [k: string]: unknown } | null; [k: string]: unknown }
interface ArtworkRow { media?: MediaRow[]; duplicateChecks?: DuplicateRow[]; [k: string]: unknown }

export function toArtworkDto<T extends ArtworkRow | null>(a: T): T {
  if (!a) return a
  return {
    ...a,
    media: a.media?.map(({ masterRef: _m, sha256: _s, pHash: _p, ...rest }) => rest),
    duplicateChecks: a.duplicateChecks?.map((d) => (d.candidate ? { ...d, candidate: (({ memberId: _id, ...c }) => c)(d.candidate) } : d)),
  } as T
}
