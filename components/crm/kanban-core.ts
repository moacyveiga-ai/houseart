// Kanban do CRM — PURE: move a card between columns (the optimistic update) and undo it when the server refuses.
import type { Stage } from '@/lib/crm/core'

export interface BoardCard { id: number; stage: Stage }
export interface Column<C extends BoardCard = BoardCard> { stage: Stage; label: string; cards: C[] }

/** The columns with the card moved to the top of `to`; the same array when the card is missing or already there. */
export function moveCard<C extends BoardCard>(columns: Column<C>[], cardId: number, to: Stage): Column<C>[] {
  const card = columns.flatMap((c) => c.cards).find((c) => c.id === cardId)
  if (!card || card.stage === to || !columns.some((c) => c.stage === to)) return columns
  return columns.map((c) => (c.stage === to
    ? { ...c, cards: [{ ...card, stage: to }, ...c.cards] }
    : { ...c, cards: c.cards.filter((x) => x.id !== cardId) }))
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
