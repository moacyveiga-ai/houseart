// robots.txt of the public site (handoff Fase 7 · SEO): the public pages are
// indexable; the panel, the APIs and the token pages are not.
import type { MetadataRoute } from 'next'
import { publicBaseUrl } from '@/lib/public-url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/e', '/e/', '/verify', '/verify/', '/design-system'], disallow: ['/api/', '/a/', '/sign/', '/transfer/', '/login', '/signup', '/collector/', '/profiles'] }],
    sitemap: `${publicBaseUrl()}/sitemap.xml`,
  }
}
