// "Cadastrar obra" of the collector (handoff "HouseArt App Colecionador" › cadobra) — PURE.
// The five steps (Origem · Artista · Fotos guiadas · Ficha · Revisão) and the "Pronto" screen,
// the chip groups of the sheet (prototype `cbGrupos`) and what is still missing.
// The chips write the existing free-text columns (technique, materials, edition,
// signatureLocation) and the category is derived from the technique.
import type { ArtworkCategory } from '@/lib/artworks/domain'

export type { ArtworkCategory }

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
  { label: 'Desenho', category: 'DRAWING' },
  { label: 'Gravura', category: 'PRINT' },
  { label: 'Fotografia', category: 'PHOTOGRAPHY' },
  { label: 'Escultura', category: 'SCULPTURE' },
  { label: 'Literatura', category: 'LITERATURE' },
  { label: 'Técnica mista', category: 'MIXED_MEDIA' },
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
  if (!s.title.trim() || s.title.trim() === 'Nova obra') out.push('o título')
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

/** The step a draft resumes at: photos until the front exists, then the sheet; a concluded one opens on the review. */
export function resumeStep(hasFront: boolean, completed = false): number {
  if (completed && hasFront) return 4
  return hasFront ? 3 : 2
}

const fold = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * What the photo reading wrote (free text — "Óleo sobre tela", "Verso, canto inferior") brought to the
 * chips of the sheet. Technique by keyword; support by the material named; edition and signature by
 * their tell-tale words. Nothing recognised → null (the chip stays empty for the person to choose).
 */
export function techniqueChipOf(text: string | null | undefined): string | null {
  if (!text) return null
  const t = fold(text)
  const direct = TECHNIQUE_CHIPS.find((c) => t.includes(fold(c.label)))
  if (direct) return direct.label
  if (/mista|mixed/.test(t)) return 'Técnica mista'
  if (/livro|manuscrit|poema|poesia|caligraf|literatur/.test(t)) return 'Literatura'
  if (/oleo|acrilic|tempera|aquarela|guache|encaustica|pintura|paint/.test(t)) return 'Pintura'
  if (/grafite|carvao|nanquim|lapis|pastel|desenho|drawing/.test(t)) return 'Desenho'
  if (/xilo|serigraf|litograf|gravura|metal ?gravura|agua-forte|print/.test(t)) return 'Gravura'
  if (/fotograf|photo|gelatina|pigmento mineral|c-print/.test(t)) return 'Fotografia'
  if (/bronze|marmore|escultura|ceramica|resina|sculpt/.test(t)) return 'Escultura'
  return null
}

export function supportChipOf(text: string | null | undefined): string | null {
  if (!text) return null
  const t = fold(text)
  if (/tela|canvas|linho/.test(t)) return 'Tela'
  if (/papel|paper|cartao/.test(t)) return 'Papel'
  if (/madeira|wood|eucatex|compensado/.test(t)) return 'Madeira'
  if (/metal|aluminio|cobre|aco/.test(t)) return 'Metal'
  return 'Outro'
}

export function editionChipOf(text: string | null | undefined): string | null {
  if (!text) return null
  const t = fold(text)
  if (/prova|p\.?a\.?\b|artist proof|\bap\b/.test(t)) return 'Prova de artista'
  if (/unica|unique|1\/1\b/.test(t)) return 'Única'
  if (/\d+\s*\/\s*\d+|tiragem|multiplo|edicao/.test(t)) return 'Múltiplo / tiragem'
  return null
}

export function signatureChipOf(text: string | null | undefined): string | null {
  if (!text) return null
  const t = fold(text)
  if (/sem assinatura|nao assinad|unsigned/.test(t)) return 'Sem assinatura'
  if (/verso|back|reverso/.test(t)) return 'Verso'
  if (/inferior direit|baixo direit|lower right|bottom right/.test(t)) return 'Frente · inferior direita'
  return 'Frente · outra posição'
}

/** A four-digit year the schema takes (1000–2100), or null. */
export function yearOf(v: string): number | null {
  return /^\d{4}$/.test(v) && Number(v) >= 1000 && Number(v) <= 2100 ? Number(v) : null
}

/** The year as the PATCH gets it: empty field → null (clears), a valid year → it, anything else → undefined (keeps what is saved). */
export function yearPatch(v: string): number | null | undefined {
  if (!v.trim()) return null
  return yearOf(v) ?? undefined
}
