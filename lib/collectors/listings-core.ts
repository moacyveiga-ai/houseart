// "Anúncios ativos" of the collector's Vendas (handoff "Web Colecionador" › Vendas) — PURE:
// the mode line and the stats line of each listed work.

export interface ActiveListingStats { views: number; likes: number; comments: number }

/** "· aceita ofertas" / "· preço fixo" / "· pausado" (a paused listing is out of the marketplace, whatever its mode). */
export function modeLine(l: { saleMode: string | null; paused: boolean }): string {
  if (l.paused) return 'pausado'
  return l.saleMode === 'FIXED' ? 'preço fixo' : 'aceita ofertas'
}

const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`

/** "312 visualizações em 7 dias · 64 curtidas · 0 comentários" (views are the listing's last 7 days). */
export function statsLine(s: ActiveListingStats): string {
  return `${n(s.views, 'visualização', 'visualizações')} em 7 dias · ${n(s.likes, 'curtida', 'curtidas')} · ${n(s.comments, 'comentário', 'comentários')}`
}

export const ACTIVE_LISTINGS_HINT = 'Para anunciar outra obra, abra-a em Coleção · Obras e toque em Vender.'
