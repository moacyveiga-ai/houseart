// The DealView serialised for the client island (BigInt → string). Pure, no
// 'use client': a function exported from a client file cannot be CALLED by a
// Server Component (the panel pages were calling `serializeDeal` that way).
import type { DealView } from '@/lib/deals/server'

export type SerializableDeal = Omit<DealView, 'amountCents' | 'shippingCents' | 'insuranceCents' | 'split'> & { amountCents: string; shippingCents: string; insuranceCents: string; split: { party: string; label: string; amountCents: string; status: string }[] }

export function serializeDeal(d: DealView): SerializableDeal {
  return { ...d, amountCents: d.amountCents.toString(), shippingCents: d.shippingCents.toString(), insuranceCents: d.insuranceCents.toString(), split: d.split.map((s) => ({ ...s, amountCents: s.amountCents.toString() })) }
}
