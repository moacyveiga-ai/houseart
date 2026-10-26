// Pure rules of the tag-reading overlay on the public verification (handoff "HouseArt
// Verificacao"): the page opened by tap shows "Lendo a etiqueta" for 1,6 s, then the
// verdict (ring closes, 0,9 s), then the overlay goes away and the page is there.

export type ReadResult = 'valid' | 'tamper' | 'unverified'
export type Verdict = 'authenticated' | 'contested' | 'stolen'
export type ReaderPhase = 'reading' | 'result' | 'done'

/** Milliseconds of each phase, as the prototype (1600 → 2500). */
export const READING_MS = 1600
export const RESULT_MS = 900

export type Outcome = 'ok' | 'attention' | 'failed'

/** What the ring says at the end: green check (authenticated), or alert red — attention (contested, stolen,
 *  unverified read) or failure (tamper). The prototype colours everything but "autenticada" with alert-500. */
export function outcomeOf(result: ReadResult, verdict: Verdict): Outcome {
  if (result === 'tamper') return 'failed'
  if (result === 'unverified') return 'attention'
  return verdict === 'authenticated' ? 'ok' : 'attention'
}

export function readerTitle(phase: ReaderPhase, result: ReadResult, verdict: Verdict): string {
  if (phase === 'reading') return 'Lendo a etiqueta'
  const o = outcomeOf(result, verdict)
  if (o === 'ok') return 'Etiqueta válida'
  if (o === 'failed') return 'Etiqueta não confirmada'
  return 'Atenção'
}

export function readerSubtitle(phase: ReaderPhase, result: ReadResult): string {
  if (phase === 'reading') return 'Mantenha o celular encostado no verso da obra'
  if (result === 'tamper') return 'A leitura indicou violação ou remoção do chip'
  if (result === 'unverified') return 'Não foi possível conferir a etiqueta com este certificado'
  return 'Abrindo o certificado…'
}

export function outcomeIcon(o: Outcome): string {
  return o === 'ok' ? 'check' : o === 'failed' ? 'link_off' : 'priority_high'
}
