// sitemap.xml of the public site: static pages, listed artworks, artists with
// listed works and galleries with a public profile.
import type { MetadataRoute } from 'next'
import { publicBaseUrl } from '@/lib/public-url'
import { marketItems } from '@/lib/marketplace/public-server'
import { listPublicArtists, listPublicGalleries } from '@/lib/public-content/server'
import { HELP_ARTICLES } from '@/components/public/help-content'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicBaseUrl()
  const [works, artists, galleries] = await Promise.all([marketItems(1000), listPublicArtists(null, 500), listPublicGalleries()])
  return [
    { url: `${base}/e`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/e/marketplace`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/e/artists`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/e/galleries`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/e/how-it-works`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/e/help`, changeFrequency: 'monthly', priority: 0.5 },
    ...HELP_ARTICLES.map((h) => ({ url: `${base}/e/help/${h.slug}`, changeFrequency: 'monthly' as const, priority: 0.4 })),
    { url: `${base}/verify`, changeFrequency: 'monthly', priority: 0.5 },
    ...works.map((w) => ({ url: `${base}/e/artwork/${w.publicId}`, lastModified: new Date(w.updatedAt), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...artists.map((a) => ({ url: `${base}/e/artist/${a.slug}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...galleries.map((g) => ({ url: `${base}/e/gallery/${g.slug}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
  ]
}
