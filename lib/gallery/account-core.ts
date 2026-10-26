// Conta da galeria — PURE: the one-line summaries of the items the audit (galeria §9) found
// missing: "Endereço e horários", "Divisão com artistas" and the plan line with the month's use.

/** "Rua Direita, 88 · Santo Antônio · Salvador · ter a sáb, 10h–19h" — or the hint when nothing is filled. */
export function addressLine(p: { street: string | null; district: string | null; city: string | null; hours: string | null } | null): string {
  const parts = p ? [p.street, p.district, p.city, p.hours].map((s) => s?.trim() || null).filter((s): s is string => !!s) : []
  return parts.length ? parts.join(' · ') : 'Endereço e horário de funcionamento no perfil público'
}

/** "3 contratos ativos · galeria fica com 40–50 %" — the share is the gallery's part of the net (ArtistContract.galleryBps). */
export function splitLine(contracts: { galleryBps: number }[]): string {
  if (contracts.length === 0) return 'Nenhum contrato registrado · a divisão é definida por artista'
  const pcts = contracts.map((c) => Math.round(c.galleryBps / 100))
  const min = Math.min(...pcts), max = Math.max(...pcts)
  const share = min === max ? `${min} %` : `${min}–${max} %`
  return `${contracts.length} ${contracts.length === 1 ? 'contrato ativo' : 'contratos ativos'} · galeria fica com ${share}`
}

/** "Plano Galeria Pro · R$ 899/mês · 18 de 40 certificações usadas" (the first bar with a limit; free plans say "Grátis"). */
export function planLine(plan: { name: string; priceLabel: string } | null, bars: { label: string; used: number; limit: number | null }[]): string {
  if (!plan) return 'Plano, uso do mês e faturas'
  const price = plan.priceLabel === 'Grátis' ? 'Grátis' : `${plan.priceLabel}/mês`
  const bar = bars.find((b) => b.limit !== null) ?? bars[0]
  const use = bar ? ` · ${bar.limit === null ? `${bar.used}` : `${bar.used} de ${bar.limit}`} ${bar.label.toLowerCase()}` : ''
  return `${plan.name} · ${price}${use}`
}
