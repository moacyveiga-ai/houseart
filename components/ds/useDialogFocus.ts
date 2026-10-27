'use client'
import { useEffect, useRef, type RefObject } from 'react'
import { FOCUSABLE, trapTarget } from './dialog-focus-core'

// The last few elements that took focus, newest last. React applies `autoFocus` before effects run, so when a dialog
// opens with a focused field `document.activeElement` is already inside it: the trigger to return to is the newest
// entry outside the dialog.
const recent: HTMLElement[] = []
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', (e) => {
    if (!(e.target instanceof HTMLElement)) return
    recent.push(e.target)
    if (recent.length > 8) recent.shift()
  }, true)
}
function lastFocusOutside(box: HTMLElement): HTMLElement | null {
  for (let i = recent.length - 1; i >= 0; i--) if (!box.contains(recent[i]) && document.contains(recent[i])) return recent[i]
  const active = document.activeElement
  return active instanceof HTMLElement && !box.contains(active) ? active : null
}

/**
 * While `open`: focus moves into the dialog (the container itself, so no keyboard pops up on the phone),
 * Tab and Shift+Tab stay inside, Esc calls `onEscape` (when given), and on close focus returns to where it was.
 * `onEscape` is read from a ref, so an inline callback does not re-run the effect (and steal focus) on every render.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean, onEscape?: () => void) {
  const escape = useRef(onEscape)
  useEffect(() => { escape.current = onEscape })
  useEffect(() => {
    if (!open) return
    const box = ref.current
    if (!box) return
    const before = lastFocusOutside(box)
    if (!box.contains(document.activeElement)) box.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escape.current) {
        // the innermost open dialog answers: a sheet opened inside this one handles its own Esc
        const last = [...document.querySelectorAll('[aria-modal="true"]')].pop()
        if (last && last !== box) return
        e.stopPropagation(); escape.current(); return
      }
      if (e.key !== 'Tab') return
      const list = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
      const to = trapTarget(list.length, list.indexOf(document.activeElement as HTMLElement), e.shiftKey)
      if (to === null) return
      e.preventDefault(); list[to].focus()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (before && document.contains(before)) before.focus({ preventScroll: true })
    }
  }, [open, ref])
}
