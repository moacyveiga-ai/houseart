// Resale royalty (Lei 9.610/98, art. 38): 5 % of the appreciation. Pure.
export const RESALE_ROYALTY_BPS = 500

export function royaltyFor(saleCents: bigint, previousSaleCents: bigint, bps = RESALE_ROYALTY_BPS): { appreciationCents: bigint; royaltyCents: bigint } {
  const appreciation = saleCents - previousSaleCents
  if (appreciation <= 0n) return { appreciationCents: 0n, royaltyCents: 0n }
  return { appreciationCents: appreciation, royaltyCents: (appreciation * BigInt(bps)) / 10000n }
}

export const ROYALTY_STATUS_LABELS: Record<string, string> = { PENDING: 'A receber', HELD: 'A receber', PAID: 'Repassado' }
