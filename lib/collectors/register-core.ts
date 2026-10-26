// "Cadastrar obra" of the collector (handoff "HouseArt App Colecionador" › cadobra) — PURE.
// The five steps (Origem · Artista · Fotos guiadas · Ficha · Revisão) and the "Pronto" screen,
// the chip groups of the sheet (prototype `cbGrupos`) and what is still missing.
// The chips write the existing free-text columns (technique, materials, edition,
// signatureLocation) and the category is derived from the technique.
import type { ARTWORK_CATEGORIES } from '@/lib/artworks/domain'

export type ArtworkCategory = (typeof ARTWORK_CATEGORIES)[number]

export const REGISTER_STEPS = [
  { key: 'origin', title: 'Como a obra chegou até você?', lead: 'Isso define quais documentos e serviços fazem sentido para ela.' },
  { key: 'artist', title: 'Quem é o artista?', lead: 'Busque pelo nome. Se não estiver na lista, escreva o nome como aparece na assinatura.' },
  { key: 'photos', title: 'Fotos guiadas', lead: 'Siga a ordem. A câmera avisa quando luz, foco e ângulo estão bons; depois de cada foto você ajusta luz, cor e recorte.' },
  { key: 'sheet', title: 'Ficha da obra', lead: 'Quanto mais completa, mais rápida a certificação.' },
  { key: 'review', title: 'Revise o cadastro', lead: 'Confira antes de concluir. Você pode editar a ficha depois.' },
] as const
export type RegisterStepKey = (typeof REGISTER_STEPS)[number]['key']

export const TECHNIQUE_CHIPS: { label: string; category: ArtworkCategory }[] = [
  { label: 'Pintura', category: 'PAINTING' },
  { label: 'Desenho', category: 'WORK_ON_PAPER' },
  { label: 'Gravura', category: 'WORK_ON_PAPER' },
  { label: 'Fotografia', category: 'PHOTOGRAPHY' },
  { label: 'Escultura', category: 'SCULPTURE' },
  { label: 'Técnica mista', category: 'OTHER' },
]
export const SUPPORT_CHIPS = ['Tela', 'Papel', 'Madeira', 'Metal', 'Outro'] as const
export const EDITION_CHIPS = ['Única', 'Múltiplo / tiragem', 'Prova de artista'] as const
export const SIGNATURE_CHIPS = ['Frente · inferior direita', 'Frente · outra posição', 'Verso', 'Sem assinatura'] as const

/** The category a technique chip implies; a technique typed elsewhere (the artist's wizard) keeps no category. */
export function categoryOfTechnique(technique: string | null | undefined): ArtworkCategory | undefined {
  return TECHNIQUE_CHIPS.find((c) => c.label === technique)?.category
}

export interface SheetState {
  title: string
  technique: string | null
  /** centimeters, as typed (comma or dot) */
  heightCm: string
  widthCm: string
}

const positiveCm = (v: string) => { const n = Number(v.replace(',', '.')); return Number.isFinite(n) && n > 0 && n <= 10_000 }

/** What the sheet still lacks to go on (prototype `okInfo`: title, technique, height and width). */
export function sheetProblems(s: SheetState): string[] {
  const out: string[] = []
  if (!s.title.trim()) out.push('o título')
  if (!s.technique) out.push('a técnica')
  if (!positiveCm(s.heightCm) || !positiveCm(s.widthCm)) out.push('altura e largura')
  return out
}

/** "Preencha o título, a técnica e altura e largura." — one sentence from the list. */
export function sheetMessage(problems: string[]): string {
  if (!problems.length) return ''
  const list = problems.length === 1 ? problems[0] : `${problems.slice(0, -1).join(', ')} e ${problems[problems.length - 1]}`
  return `Preencha ${list}.`
}

/** "120 × 90 × 4 cm" from millimeters (null when height or width is missing). */
export function dimensionsLabel(heightMm: number | null, widthMm: number | null, depthMm: number | null): string | null {
  if (!heightMm || !widthMm) return null
  const cm = (mm: number) => String(Math.round(mm) / 10).replace('.', ',')
  return `${cm(heightMm)} × ${cm(widthMm)}${depthMm ? ` × ${cm(depthMm)}` : ''} cm`
}

/** Millimeters back to the centimeters the field shows ("" when empty). */
export function cmOf(mm: number | null): string {
  return mm ? String(Math.round(mm) / 10).replace('.', ',') : ''
}

/** The three "Próximos passos" of the Pronto screen (prototype `cbProximos`, register mode). */
export const NEXT_STEPS = [
  { title: 'Obra cadastrada na coleção', sub: 'Fotos, ficha e proveniência guardadas', icon: 'check', done: true },
  { title: 'Peça serviços quando quiser', sub: 'Na página da obra: certificação, laudo, seguro e mais', icon: 'home_repair_service', done: false },
  { title: 'Certifique para vender', sub: 'Com etiqueta NFC e escritura em seu nome', icon: 'verified', done: false },
] as const

/** The step a draft resumes at: photos until the front exists, then the sheet. */
export function resumeStep(hasFront: boolean): number {
  return hasFront ? 3 : 2
}
