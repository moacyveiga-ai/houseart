// Wizard decisions — PURE (tested): what each step saves, the review lines,
// the next-button label, the media summary.
import { categoryLabel, CONDITION_GRADE_LABELS, CONDITION_STATE_LABELS, formatBRL, formatDimensions, MEDIA_SLOTS, REQUIRED_MEDIA_SLOTS, WIZARD_STEPS } from '@/lib/artworks/domain'

export interface WizardMedia { id: number; kind: string; publicUrl: string | null; quality: string | null }
export interface WizardRegion { region: string; note: string; state: string }
export interface WizardHistory { kind: string; description: string; occurredOn: string }

export interface WizardState {
  title: string; year: number | null; technique: string | null; materials: string | null
  /** one of the seven techniques of the handoff (lib/artworks/domain ARTWORK_CATEGORIES) */
  category: string
  heightMm: number | null; widthMm: number | null; depthMm: number | null
  edition: string | null; signatureLocation: string | null; series: string | null
  conditionGrade: string | null; saleMode: string | null; listPriceCents: number | null
  media: WizardMedia[]; conditionRegions: WizardRegion[]; historyItems: WizardHistory[]
}

export const STEP_COUNT = WIZARD_STEPS.length

export function nextLabel(step: number): string {
  return step === STEP_COUNT - 1 ? 'Enviar para certificação' : 'Continuar'
}

export function mediaSummary(media: WizardMedia[]): string {
  const have = REQUIRED_MEDIA_SLOTS.filter((s) => media.some((m) => m.kind === s.kind)).length
  const pending = REQUIRED_MEDIA_SLOTS.length - have
  const extras = MEDIA_SLOTS.filter((s) => !s.required && media.some((m) => m.kind === s.kind)).length
  return `${have} de ${REQUIRED_MEDIA_SLOTS.length} fotos obrigatórias${pending ? ` · ${pending} pendente(s)` : ''}${extras ? ` · ${extras} opcional(is)` : ''}`
}

export function reviewLines(s: WizardState): { k: string; v: string }[] {
  const attention = s.conditionRegions.filter((r) => r.state !== 'INTACT').length
  const grade = s.conditionGrade ? CONDITION_GRADE_LABELS[s.conditionGrade as keyof typeof CONDITION_GRADE_LABELS] ?? s.conditionGrade : '—'
  return [
    { k: 'Título', v: `${s.title}${s.year ? `, ${s.year}` : ''}` },
    { k: 'Técnica', v: [categoryLabel(s.category), s.technique].filter(Boolean).join(' · ') || '—' },
    { k: 'Dimensões', v: formatDimensions(s) },
    { k: 'Edição', v: s.edition || '—' },
    { k: 'Mídia', v: mediaSummary(s.media) },
    { k: 'Condition report', v: `${grade}${attention ? ` · ${attention} ponto(s) de atenção` : ''}` },
    { k: 'Preço', v: s.saleMode === 'ON_REQUEST' ? 'Sob consulta' : `${formatBRL(s.listPriceCents)}${s.saleMode === 'FIXED_WITH_OFFERS' ? ' · aceita ofertas' : ''}` },
  ]
}

export function regionStateLabel(state: string): string {
  return CONDITION_STATE_LABELS[state as keyof typeof CONDITION_STATE_LABELS] ?? state
}

/** The PATCH body of the sheet (step 1) — only the sheet fields. */
export function sheetPatch(s: WizardState) {
  return {
    title: s.title, year: s.year, category: s.category, technique: s.technique, materials: s.materials,
    heightMm: s.heightMm === null ? null : s.heightMm / 10, widthMm: s.widthMm === null ? null : s.widthMm / 10, depthMm: s.depthMm === null ? null : s.depthMm / 10,
    edition: s.edition, signatureLocation: s.signatureLocation, series: s.series,
  }
}
