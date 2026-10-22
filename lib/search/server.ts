// Global search (topbar "Buscar obras, artistas, galerias ou IDs"): public
// artworks by title/artist/publicId, artists and galleries by name. Public
// data only — the viewer's own inventory stays on its own screens.
import 'server-only'
import { listPublicArtworks, type PublicArtworkCard } from '@/lib/marketplace/public-server'
import { listPublicArtists, listPublicGalleries, type PublicArtistCard, type PublicGalleryCard } from '@/lib/public-content/server'
import { normalizeQuery, looksLikePublicId } from './core'

export interface SearchResult { q: string; artworks: PublicArtworkCard[]; artists: PublicArtistCard[]; galleries: PublicGalleryCard[]; total: number }

export async function search(raw: string | null | undefined): Promise<SearchResult> {
  const q = normalizeQuery(raw)
  if (!q) return { q: '', artworks: [], artists: [], galleries: [], total: 0 }
  const [artworks, artists, galleries] = await Promise.all([
    listPublicArtworks({ q }, 24),
    looksLikePublicId(q) ? [] : listPublicArtists(q, 12),
    looksLikePublicId(q) ? [] : listPublicGalleries({ q }),
  ])
  return { q, artworks, artists, galleries: galleries.slice(0, 12), total: artworks.length + artists.length + Math.min(galleries.length, 12) }
}
