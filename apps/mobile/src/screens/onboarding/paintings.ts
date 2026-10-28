// Public-domain paintings behind the splash — the SAME list as the web login and "Concluir cadastro"
// (lib/public-content/paintings.ts › WALL_PAINTINGS; keep both in step). The files live in the house's
// public media (Wikimedia Commons, uploaded on 2026-10-28); the app loads them from the API host.
export interface Wall { path: string; credit: string }

const M = '/api/public/media/content'
const pd = (artist: string, title: string, year: string) => `${artist} · ${title}, ${year} · domínio público`

export const WALLS: readonly Wall[] = [
  { path: `${M}/news/1792772349313-1i5ga4cihuc.jpg`, credit: pd('Vincent van Gogh', 'A noite estrelada', '1889') },
  { path: `${M}/artists/2/1793215383030-bq3ghfyu4yp.jpg`, credit: pd('Johannes Vermeer', 'Moça com brinco de pérola', 'c. 1665') },
  { path: `${M}/artists/2/1793215394012-87qkmwurdcs.jpg`, credit: pd('Gustav Klimt', 'O beijo', '1908') },
  { path: `${M}/artists/2/1793215397767-hwzo6bqbwzv.jpg`, credit: pd('Vincent van Gogh', 'Girassóis', '1888') },
  { path: `${M}/artists/2/1793215390137-29dcu12xb2m.jpg`, credit: pd('Katsushika Hokusai', 'A grande onda de Kanagawa', 'c. 1831') },
  { path: `${M}/artists/2/1793215410895-01hd1p2eq8ly.jpg`, credit: pd('Almeida Júnior', 'Caipira picando fumo (estudo)', '1893') },
  { path: `${M}/artists/2/1793215387275-e55iywga056.jpg`, credit: pd('Claude Monet', 'Impressão, nascer do sol', '1872') },
  { path: `${M}/artists/2/1793215401232-u6o12av21i.jpg`, credit: pd('Georges Seurat', 'Uma tarde de domingo na Ilha de La Grande Jatte', '1884') },
  { path: `${M}/artists/2/1793215414521-qpb33rxk6d.jpg`, credit: pd('Claude Monet', 'Ninfeias', '1906') },
  { path: `${M}/artists/2/1793215403954-fai9nezvqo.jpg`, credit: pd('Sandro Botticelli', 'O nascimento de Vênus', 'c. 1485') },
]

/** One wall at random (`rand` injectable). */
export function randomWall(rand: () => number = Math.random): Wall {
  return WALLS[Math.floor(rand() * WALLS.length) % WALLS.length]!
}
