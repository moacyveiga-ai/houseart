// Public-domain paintings that dress the public Home and the login panel (decision of
// Moacy, 2026-10-28). The files were taken from Wikimedia Commons and stored in the
// house public media; nothing here is a work sold or certified on HouseArt, so the
// decorative frames never link to the marketplace.
export interface Painting { src: string; artist: string; title: string; year: string }

const M = '/api/public/media/content'

export const STARRY_NIGHT: Painting = { src: `${M}/news/1792772349313-1i5ga4cihuc.jpg`, artist: 'Vincent van Gogh', title: 'A noite estrelada', year: '1889' }

/** credit line shown under a painting: "Artista · Obra, ano · domínio público" */
export const paintingCredit = (p: Painting): string => `${p.artist} · ${p.title}, ${p.year} · domínio público`

const P = (file: string, artist: string, title: string, year: string): Painting => ({ src: `${M}/artists/2/${file}`, artist, title, year })

/** One painting per decorative frame of the Home, in the order the page uses them. */
export const HOME_PAINTINGS = {
  manifesto: [
    P('1793215383030-bq3ghfyu4yp.jpg', 'Johannes Vermeer', 'Moça com brinco de pérola', 'c. 1665'),
    P('1793215394012-87qkmwurdcs.jpg', 'Gustav Klimt', 'O beijo', '1908'),
  ],
  market: [
    P('1793215397767-hwzo6bqbwzv.jpg', 'Vincent van Gogh', 'Girassóis', '1888'),
    P('1793215390137-29dcu12xb2m.jpg', 'Katsushika Hokusai', 'A grande onda de Kanagawa', 'c. 1831'),
    P('1793215410895-01hd1p2eq8ly.jpg', 'Almeida Júnior', 'Caipira picando fumo (estudo)', '1893'),
  ],
  pillars: [
    P('1793215387275-e55iywga056.jpg', 'Claude Monet', 'Impressão, nascer do sol', '1872'),
    P('1793215401232-u6o12av21i.jpg', 'Georges Seurat', 'Uma tarde de domingo na Ilha de La Grande Jatte', '1884'),
    P('1793215414521-qpb33rxk6d.jpg', 'Claude Monet', 'Ninfeias', '1906'),
  ],
  final: [
    P('1793215403954-fai9nezvqo.jpg', 'Sandro Botticelli', 'O nascimento de Vênus', 'c. 1485'),
    P('1793215418156-kpuh2zpjcd.jpg', 'Almeida Júnior', 'Saudade', '1899'),
  ],
} satisfies Record<string, Painting[]>
