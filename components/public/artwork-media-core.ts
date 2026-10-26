// Media of the public artwork page — PURE: which photos become the stage's
// thumbnails and in what order (audit público §10: use the real DETAIL,
// SIGNATURE and IN_SITU photos; the front zoomed in is only the fallback for a
// work photographed without them).
export type MediaView = 'front' | 'back' | 'detail' | 'photo'
export interface MediaItem { label: string; src: string; view: MediaView; origin?: string }

import { PUBLIC_MEDIA_KINDS } from '@/lib/artworks/domain'

const LABELS: Record<string, { label: string; view: MediaView }> = {
  FRONT_COLOR_CARD: { label: 'Frente', view: 'front' },
  BACK: { label: 'Verso e etiqueta', view: 'back' },
  DETAIL: { label: 'Detalhe', view: 'photo' },
  SIGNATURE: { label: 'Assinatura', view: 'photo' },
  IN_SITU: { label: 'Na parede', view: 'photo' },
}

/**
 * Frente · Verso e etiqueta · Detalhe · Assinatura · Na parede, each only when the photo exists.
 * Without any close-up (no DETAIL nor SIGNATURE) the front at scale 2.4 stands in as
 * "Detalhe 1 / 2", as the prototype draws it.
 */
export function mediaItemsOf(media: { kind: string; url: string }[]): MediaItem[] {
  const byKind = new Map(media.map((m) => [m.kind, m.url]))
  const out: MediaItem[] = []
  for (const kind of PUBLIC_MEDIA_KINDS) {
    const url = byKind.get(kind)
    if (url) out.push({ ...LABELS[kind], src: url })
  }
  const front = byKind.get('FRONT_COLOR_CARD')
  if (front && !byKind.has('DETAIL') && !byKind.has('SIGNATURE')) {
    out.push({ label: 'Detalhe 1', src: front, view: 'detail', origin: '30% 25%' }, { label: 'Detalhe 2', src: front, view: 'detail', origin: '70% 75%' })
  }
  return out
}
