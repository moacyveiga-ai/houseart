// Web App Manifest (/manifest.webmanifest): the HouseArt panel installs as an app from the browser
// (Android/desktop Chrome "Instalar", iPhone "Adicionar à Tela de Início"). One app for every profile —
// the panel already opens on the home of the active profile. `start_url` is /login: signed in, it goes
// straight to the panel; signed out, it asks to sign in (an installed app never lands on the public site).
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'HouseArt',
    short_name: 'HouseArt',
    description: 'Certificação, proveniência e venda de obras de arte com escritura digital.',
    lang: 'pt-BR',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FBFAF7',
    theme_color: '#FBFAF7',
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
