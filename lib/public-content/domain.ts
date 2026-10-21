// Public content of the handoff pages (Artista, Galeria, Galerias, Home): allowlists and labels.
export const ARTIST_ENTRY_KINDS = ['TRAJECTORY', 'SOLO', 'GROUP', 'AWARD', 'EDUCATION', 'COLLECTION'] as const
export type ArtistEntryKind = (typeof ARTIST_ENTRY_KINDS)[number]

export const PUBLICATION_KINDS = ['EBOOK', 'CATALOGUE', 'ESSAY', 'INTERVIEW', 'RAISONNE'] as const
export const PUBLICATION_KIND_LABELS: Record<(typeof PUBLICATION_KINDS)[number], string> = { EBOOK: 'E-book', CATALOGUE: 'Catálogo', ESSAY: 'Ensaio', INTERVIEW: 'Entrevista', RAISONNE: 'Catálogo raisonné' }
export const PUBLICATION_ACTIONS = ['BUY', 'DOWNLOAD', 'READ'] as const
export const PUBLICATION_ACTION_LABELS: Record<(typeof PUBLICATION_ACTIONS)[number], { label: string; icon: string }> = { BUY: { label: 'Comprar', icon: 'shopping_bag' }, DOWNLOAD: { label: 'Baixar', icon: 'download' }, READ: { label: 'Ler', icon: 'menu_book' } }

export const GALLERY_ITEM_KINDS = ['MILESTONE', 'TEAM', 'PHOTO', 'VIDEO', 'ROOM'] as const

export const AGENDA_KINDS = ['FAIR', 'EXHIBITION', 'OPENING', 'AUCTION'] as const
export type AgendaKind = (typeof AGENDA_KINDS)[number]
export const AGENDA_KIND_LABELS: Record<AgendaKind, string> = { FAIR: 'Feira', EXHIBITION: 'Exposição', OPENING: 'Abertura', AUCTION: 'Leilão' }

/** Paragraphs of a long text (blank line = new paragraph). */
export const paragraphsOf = (text: string | null | undefined): string[] =>
  (text ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

export const jsonList = (s: string | null | undefined): string[] => {
  try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [] } catch { return [] }
}

/** "1931–2009" for a deceased artist, null otherwise. */
export const lifeSpan = (birth: number | null, death: number | null): string | null => (death ? `${birth ?? '?'}–${death}` : null)
