// Focus trap of a dialog (audit design-system §5: "nenhum dialog gerencia o foco"): pure, so the wrap rule is tested.

/** What can take focus inside a dialog. */
export const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Index to move to when Tab is pressed, or null to let the browser do it.
 * `current` is the index of the focused element in the list, -1 when focus is on the dialog itself or outside it.
 */
export function trapTarget(count: number, current: number, shift: boolean): number | null {
  if (count === 0) return null
  if (current === -1) return shift ? count - 1 : 0
  if (shift && current === 0) return count - 1
  if (!shift && current === count - 1) return 0
  return null
}
