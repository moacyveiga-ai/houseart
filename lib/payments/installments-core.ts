// Card installments at checkout ("até 10× sem juros", handoff App Colecionador › checkout) — PURE.
// The buyer picks 1×, 3×, 6× or 10× of the same total (no interest); a plan only shows up when
// each installment is at least R$ 100, so a cheap work is not split into coins. The server
// checks the count against the same rule before charging.

export const INSTALLMENT_COUNTS = [1, 3, 6, 10] as const
export const MIN_INSTALLMENT_CENTS = 10_000

export interface InstallmentOption { count: number; eachCents: number }

/** Each installment rounded UP to the cent (the last one absorbs the difference at the card network). */
export function installmentValue(totalCents: number, count: number): number {
  return Math.ceil(totalCents / count)
}

/** The plans offered for this total (1× always). */
export function installmentOptions(totalCents: number): InstallmentOption[] {
  const total = Math.max(0, Math.round(totalCents))
  return INSTALLMENT_COUNTS
    .filter((n) => n === 1 || Math.floor(total / n) >= MIN_INSTALLMENT_CENTS)
    .map((n) => ({ count: n, eachCents: installmentValue(total, n) }))
}

/** Whether `count` is a plan the checkout offers for this total. */
export function validInstallments(totalCents: number, count: number): boolean {
  return Number.isInteger(count) && installmentOptions(totalCents).some((o) => o.count === count)
}

/** The largest plan offered (to keep a choice valid when the total changes). */
export function clampInstallments(totalCents: number, count: number): number {
  const ok = installmentOptions(totalCents).map((o) => o.count).filter((n) => n <= count)
  return ok.length ? ok[ok.length - 1] : 1
}
