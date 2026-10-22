// Leitor (notícia e guia) — regras puras: os blocos do texto, o rótulo de
// leitura e o progresso de rolagem.
export type ReadBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'q'; text: string }
  | { kind: 'li'; text: string; sub: string }

/** Plain paragraphs become `p` blocks (the news body has no markup). */
export const paragraphBlocks = (paragraphs: string[]): ReadBlock[] => paragraphs.map((text) => ({ kind: 'p', text }))

export const readMinutesLabel = (minutes: number) => `${Math.max(1, minutes)} min de leitura`

/** 0..1 of the article read: how far the bottom of the viewport advanced into the article. */
export function readProgress(articleTop: number, articleHeight: number, scrollY: number, viewportHeight: number): number {
  if (articleHeight <= 0) return 0
  const seen = scrollY + viewportHeight - articleTop
  return Math.min(1, Math.max(0, seen / articleHeight))
}

/** The step marks of a trail ("Guia 2 de 5"): the first `step` are lit. */
export const trailSegments = (step: number, total: number): boolean[] => Array.from({ length: total }, (_, i) => i < step)

/** The blocks with the running number of each `li` (1, 2, 3…), decided before render. */
export const numberedBlocks = (blocks: ReadBlock[]): (ReadBlock & { n: number | null })[] => {
  let n = 0
  return blocks.map((b) => ({ ...b, n: b.kind === 'li' ? ++n : null }))
}
