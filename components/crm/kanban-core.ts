// Kanban do CRM — PURE: move a card between columns (the optimistic update) and undo it when the server refuses.
import type { Stage } from '@/lib/crm/core'

export interface BoardCard { id: number; stage: Stage }
export interface Column<C extends BoardCard = BoardCard> { stage: Stage; label: string; cards: C[] }

/** The columns with the card moved into `to` — at `index` (an undo puts it back where it was) or the top; the same array when the card is missing or already there. */
export function moveCard<C extends BoardCard>(columns: Column<C>[], cardId: number, to: Stage, index = 0): Column<C>[] {
  const card = columns.flatMap((c) => c.cards).find((c) => c.id === cardId)
  if (!card || card.stage === to || !columns.some((c) => c.stage === to)) return columns
  return columns.map((c) => {
    if (c.stage !== to) return { ...c, cards: c.cards.filter((x) => x.id !== cardId) }
    const at = Math.max(0, Math.min(index, c.cards.length))
    return { ...c, cards: [...c.cards.slice(0, at), { ...card, stage: to }, ...c.cards.slice(at)] }
  })
}

/** Where a card sits (column and position), to put it back after a refusal. */
export function placeOf(columns: Column[], cardId: number): { stage: Stage; index: number } | null {
  for (const c of columns) {
    const index = c.cards.findIndex((x) => x.id === cardId)
    if (index >= 0) return { stage: c.stage, index }
  }
  return null
}

/** The column under a point, by the columns' boxes (the dragged card itself sits under the finger, so hit testing would return it). */
export function stageAtPoint(boxes: { stage: Stage; left: number; right: number; top: number; bottom: number }[], x: number, y: number): Stage | null {
  return boxes.find((b) => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom)?.stage ?? null
}

/** The stage a card sits in (null when it is not on the board). */
export function stageOf(columns: Column[], cardId: number): Stage | null {
  return columns.find((c) => c.cards.some((x) => x.id === cardId))?.stage ?? null
}

/** Arrow keys on a focused card: the column to the left or right, or null at the edges. */
export function neighbourStage(columns: Column[], from: Stage, dir: -1 | 1): Stage | null {
  const i = columns.findIndex((c) => c.stage === from)
  return columns[i + dir]?.stage ?? null
}
