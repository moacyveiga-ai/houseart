// Offer state machine — PURE. Every invalid transition is a typed error.
import type { OfferStatus } from './domain'

export class InvalidOfferTransition extends Error {
  constructor(public readonly from: OfferStatus, public readonly to: OfferStatus) {
    super(`Transição inválida: ${from} → ${to}`); this.name = 'InvalidOfferTransition'
  }
}

export const OFFER_TRANSITIONS: Record<OfferStatus, readonly OfferStatus[]> = {
  DRAFT: ['AWAITING_OTP', 'CANCELLED'],
  AWAITING_OTP: ['RECEIVED', 'BELOW_RESERVE', 'CANCELLED'],
  BELOW_RESERVE: ['RECEIVED', 'NEGOTIATING', 'ACCEPTED', 'REFUSED', 'RETRACTED', 'EXPIRED', 'CANCELLED'],
  RECEIVED: ['NEGOTIATING', 'ACCEPTED', 'REFUSED', 'RETRACTED', 'EXPIRED', 'CANCELLED'],
  NEGOTIATING: ['ACCEPTED', 'REFUSED', 'RETRACTED', 'EXPIRED', 'CANCELLED'],
  ACCEPTED: ['IN_DEAL', 'CANCELLED'],
  IN_DEAL: ['CONVERTED', 'REFUSED', 'CANCELLED'],
  CONVERTED: [], REFUSED: [], RETRACTED: [], EXPIRED: [], CANCELLED: [],
}

export function canTransition(from: OfferStatus, to: OfferStatus): boolean {
  return OFFER_TRANSITIONS[from].includes(to)
}

export function assertTransition(from: OfferStatus, to: OfferStatus): void {
  if (!canTransition(from, to)) throw new InvalidOfferTransition(from, to)
}

export function isTerminal(status: OfferStatus): boolean {
  return OFFER_TRANSITIONS[status].length === 0
}

/** After the OTP: at or above the floor → RECEIVED; below → BELOW_RESERVE (the buyer is told "recebida" either way). */
export function statusAfterOtp(reachesReserve: boolean): 'RECEIVED' | 'BELOW_RESERVE' {
  return reachesReserve ? 'RECEIVED' : 'BELOW_RESERVE'
}

/** What the BUYER is shown: BELOW_RESERVE is reported as RECEIVED (the floor never leaks). */
export function buyerFacingStatus(status: OfferStatus): OfferStatus {
  return status === 'BELOW_RESERVE' ? 'RECEIVED' : status
}
