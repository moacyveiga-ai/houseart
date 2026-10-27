// "Preço reduzido" (handoff "HouseArt Web Galeria" › Gestão do anúncio) — PURE.
// When the price of a listing goes down, the people who saved the work hear about it.

export const PRICE_DROP_MAX_RECIPIENTS = 500

/** Who gets the notice: each saver once, never the person who changed the price; capped. */
export function priceDropRecipients(saverIds: readonly number[], actorUserId: number): number[] {
  const out: number[] = []
  const seen = new Set<number>([actorUserId])
  for (const id of saverIds) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= PRICE_DROP_MAX_RECIPIENTS) break
  }
  return out
}

const brl = (c: bigint) => Number(c / 100n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/** The notice: "Obra que você salvou baixou de preço" · "Construção nº 7 · de R$ 38.000 por R$ 34.000". */
export function priceDropNotice(a: { title: string; publicId: string }, fromCents: bigint, toCents: bigint): { title: string; body: string; href: string } {
  return { title: 'Obra que você salvou baixou de preço', body: `${a.title} · de ${brl(fromCents)} por ${brl(toCents)}`, href: `/e/artwork/${a.publicId}` }
}
