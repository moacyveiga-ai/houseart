// Cadastrar obra da galeria (handoff "HouseArt Web Galeria" › Cadastrar obra) — PURE: the five steps,
// the "Obra cadastrada" next steps and the words of the provenance fields. The screen is the collector's
// register with this variant (components/collector/RegisterArtworkScreen.tsx); the origin cards are
// GALLERY_SOURCE_CARDS of lib/artworks/domain.
import type { RegisterStep } from '@/lib/collectors/register-core'

export const GALLERY_REGISTER_STEPS: readonly RegisterStep[] = [
  { key: 'origin', title: 'De onde vem esta obra?', lead: 'Define a divisão da venda e os documentos pedidos.' },
  { key: 'artist', title: 'Quem é o artista?', lead: 'Escolha entre os artistas da galeria ou busque na HouseArt. Se não estiver em lugar nenhum, escreva o nome.' },
  { key: 'photos', title: 'Fotos guiadas', lead: 'Siga a ordem. A câmera avisa quando luz, foco e ângulo estão bons; depois de cada foto você ajusta luz, cor e recorte.' },
  { key: 'sheet', title: 'Ficha da obra', lead: 'Quanto mais completa, mais rápida a certificação.' },
  { key: 'review', title: 'Revisão', lead: 'Confira antes de concluir. Você pode editar a ficha depois, no Acervo.' },
]

export const GALLERY_NEXT_STEPS = [
  { title: 'Obra cadastrada no acervo', sub: 'Fotos, ficha e proveniência guardadas', icon: 'check', done: true },
  { title: 'Certifique para vender', sub: 'Vincule a etiqueta NFC e assine o certificado em Certificação', icon: 'verified', done: false },
  { title: 'Gestão do anúncio', sub: 'Preço, ofertas e visibilidade na página da obra', icon: 'sell', done: false },
] as const

/** Provenance block of the sheet: the gallery's words for the same three columns. */
export const GALLERY_PROVENANCE = {
  title: 'Proveniência',
  from: { label: 'Origem / consignante', placeholder: 'Artista, colecionador ou espólio' },
  year: { label: 'Ano de entrada no acervo', placeholder: 'Ex.: 2026' },
  paid: { label: 'Valor de custo ou preço acordado com o artista', note: 'fica só com a galeria' },
  note: { label: 'Observações', placeholder: 'História da obra, exposições, restauros anteriores…' },
} as const

/** A represented artist as the suggestion list shows it (before any search). */
export interface RegisterArtistOption { id: number; name: string; sub: string }

export function artistOptionsOf(artists: { id: number; name: string; contract: { kindLabel: string } | null; hasAccount: boolean }[]): RegisterArtistOption[] {
  return artists.map((a) => ({ id: a.id, name: a.name, sub: [a.contract?.kindLabel ?? 'Sem contrato', a.hasAccount ? 'na HouseArt' : 'sem conta'].join(' · ') }))
}
