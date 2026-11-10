// Fills scripts/demo/images with REAL public-domain works (run before scenario.mjs, where the network reaches
// the hosts): the fronts come from the house public media (the Home paintings, lib/public-content/paintings.ts) and
// from Wikimedia Commons; the four macros are corner details cut from the front. The back stays the generic one.
//   DEMO_BASE_URL=https://www.houseart.com.br node scripts/demo/real-works.manual.mjs   (needs `sharp`)
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const BASE = (process.env.DEMO_BASE_URL ?? 'https://www.houseart.com.br').replace(/\/$/, '')
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'images')
const M = `${BASE}/api/public/media/content`
const commons = (file) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1600`
// index = the image index scenario.mjs gives each work; several candidates = tried in order
const WORKS = {
  0: [`${M}/news/1792772349313-1i5ga4cihuc.jpg`],                                  // Van Gogh, A noite estrelada
  1: [`${M}/artists/2/1793215397767-hwzo6bqbwzv.jpg`],                             // Van Gogh, Girassóis
  2: [commons('Vincent van Gogh - De slaapkamer - Google Art Project.jpg'), commons('Vincent Willem van Gogh 137.jpg'), commons('Van Gogh - Das Schlafzimmer in Arles.jpeg')], // O quarto em Arles
  5: [`${M}/artists/2/1793215390137-29dcu12xb2m.jpg`],                             // Hokusai, A grande onda
  6: [commons('Red Fuji southern wind clear morning.jpg'), commons('Katsushika Hokusai - Fine Wind, Clear Morning (Gaifū kaisei) - Google Art Project.jpg')], // Fuji vermelho
  3: [`${M}/artists/2/1793215387275-e55iywga056.jpg`],                             // Monet, Impressão, nascer do sol
  4: [`${M}/artists/2/1793215414521-qpb33rxk6d.jpg`],                              // Monet, Ninfeias
  7: [`${M}/artists/2/1793215383030-bq3ghfyu4yp.jpg`],                             // Vermeer, Moça com brinco de pérola
  8: [`${M}/artists/2/1793215410895-01hd1p2eq8ly.jpg`],                            // Almeida Júnior, Caipira picando fumo (estudo)
}

async function fetchFirst(urls) {
  for (const url of urls) {
    const r = await fetch(url, { headers: { 'user-agent': 'houseart-demo/1.0 (demo content; public domain works)' }, redirect: 'follow' })
    if (r.ok && (r.headers.get('content-type') ?? '').startsWith('image/')) return Buffer.from(await r.arrayBuffer())
    console.log(`  (não veio: ${url.slice(0, 110)} → ${r.status})`)
  }
  throw new Error('nenhuma fonte respondeu')
}

for (const [i, urls] of Object.entries(WORKS)) {
  const src = await fetchFirst(urls)
  const front = await sharp(src).rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
  const { width, height } = await sharp(front).metadata()
  writeFileSync(path.join(OUT, `front-${i}.jpg`), front)
  const w = Math.round(width * 0.42), h = Math.round(height * 0.42)
  const corners = { tl: [0, 0], tr: [width - w, 0], bl: [0, height - h], br: [width - w, height - h] }
  for (const [k, [left, top]] of Object.entries(corners)) {
    const macro = await sharp(front).extract({ left, top, width: w, height: h }).resize({ width: 1200 }).jpeg({ quality: 86 }).toBuffer()
    writeFileSync(path.join(OUT, `macro-${i}-${k}.jpg`), macro)
  }
  console.log(`obra ${i}: ${width}×${height}`)
}
console.log('✓ imagens reais prontas')
