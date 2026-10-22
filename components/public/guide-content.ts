// Guia de educação (handoff "HouseArt App Colecionador" › Guia de educação): o
// conteúdo do protótipo (post `p2` e a leitura `LER.p2`), estático até a casa
// ter editor de conteúdo. Um guia só, em /e/guide; mais guias viram
// /e/guide/<slug> quando existirem.
import type { ReadBlock } from './reading-core'

export interface Guide { slug: string; kicker: string; title: string; lead: string; author: string; readMinutes: number; trail: { name: string; step: number; total: number }; blocks: ReadBlock[]; next: string }

export const GUIDE: Guide = {
  slug: 'como-ler-um-certificado',
  kicker: 'Guia · 4 min',
  title: 'Como ler um certificado antes de comprar',
  lead: 'Cinco pontos para conferir antes de fazer uma oferta.',
  author: 'Educação HouseArt',
  readMinutes: 4,
  trail: { name: 'Trilha · Comprar com segurança', step: 2, total: 5 },
  blocks: [
    { kind: 'p', text: 'O certificado é a certidão de nascimento da obra. Ele diz quem fez, quando, como e por onde ela passou. Saber ler cada parte evita a maioria dos problemas.' },
    { kind: 'li', text: 'Número e etiqueta', sub: 'O número do certificado é o mesmo gravado na etiqueta NFC do verso. Encoste o celular para conferir.' },
    { kind: 'li', text: 'Assinatura do artista', sub: 'Feita digitalmente e carimbo do tempo: ninguém consegue alterar depois.' },
    { kind: 'li', text: 'Ficha técnica', sub: 'Técnica, suporte e medidas precisam bater com o que você vê nas fotos.' },
    { kind: 'li', text: 'Proveniência', sub: 'A lista de donos anteriores. Lacunas longas merecem uma pergunta ao vendedor.' },
    { kind: 'li', text: 'Condition report', sub: 'Fotos do estado de conservação, com data. Se não houver, peça antes de ofertar.' },
    { kind: 'q', text: 'Se algum item não fecha, pergunte antes. Bons vendedores respondem rápido.' },
  ],
  next: 'Como fazer uma boa primeira oferta',
}
