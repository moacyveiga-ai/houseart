import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import './globals.css'
import './ds/tokens.css'
import './ds/cells.css'
import { antiFlashScript } from '@/lib/theme-routes'
import { publicBaseUrl } from '@/lib/public-url'

// Fraunces (display) + Inter (UI), exposed as --font-fraunces / --font-inter
// and consumed by --ha-font-display / --ha-font-ui (app/ds/tokens.css).
// Variable Fraunces with the optical-size axis and a real italic (artwork titles are italic in the design; synthetic italic before 2026-10-25).
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', style: ['normal', 'italic'], axes: ['opsz'], display: 'swap' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export const metadata: Metadata = {
  // absolute Open Graph and canonical URLs for every page (audit 2026-10-25: shared links had relative images)
  metadataBase: new URL(publicBaseUrl()),
  title: 'HouseArt — Obras autenticadas',
  description: 'Certificação, proveniência e venda de obras de arte com escritura digital.',
  openGraph: { siteName: 'HouseArt', locale: 'pt_BR', type: 'website', images: [{ url: '/brand/marca_houseart_full_horiz_color.png', alt: 'HouseArt' }] },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: antiFlashScript() }} />
        {/* Material Symbols Rounded: no npm package; the ligature is rendered by components/ds/Icon.tsx. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- root layout of the App Router; the rule is about pages/ */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..600,0..1,0&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  )
}
