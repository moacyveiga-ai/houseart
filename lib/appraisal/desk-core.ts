// Appraisal desk — pure rules of the queue the team and the appraisers share
// (audit 2026-10-25, web-app §5: "atribuir avaliador ao laudo; ver prazos").
// Who may assign, take, move the deadline, cancel and issue; the derived
// state of a request (overdue is derived from dueOn, never written).
import { hasTotalScope } from '@/lib/auth/profiles'

export const DESK_FILTERS = ['open', 'mine', 'unassigned', 'overdue', 'issued', 'cancelled'] as const
export type DeskFilter = (typeof DESK_FILTERS)[number]
export const DESK_FILTER_LABELS: Record<DeskFilter, string> = { open: 'Abertos', mine: 'Meus', unassigned: 'Sem avaliador', overdue: 'Atrasados', issued: 'Emitidos', cancelled: 'Cancelados' }
export const filterKey = (raw: string | undefined): DeskFilter => (DESK_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as DeskFilter) : 'open'

export type DeskState = 'QUEUED' | 'IN_PROGRESS' | 'OVERDUE' | 'ISSUED' | 'CANCELLED'
export const DESK_STATE_LABELS: Record<DeskState, string> = { QUEUED: 'Na fila', IN_PROGRESS: 'Em análise', OVERDUE: 'Atrasado', ISSUED: 'Emitido', CANCELLED: 'Cancelado' }

export const CANCEL_NOTE_MAX = 200
/** The deadline may be moved up to this far ahead (the design's 5 days, with room for a holiday week). */
export const MAX_DUE_DAYS = 60

export interface Actor { userId: number; profile: string }

export interface DeskRow {
  id: number; status: string; dueOn: string
  assignedAppraiserId: number | null
}

export const isOpen = (status: string) => status === 'QUEUED' || status === 'IN_PROGRESS'

/** One criterion for "late": the calendar day in the house zone has passed (the same day `daysLeft` and `dueLabel` count). */
export function stateOf(r: Pick<DeskRow, 'status' | 'dueOn'>, now: Date): DeskState {
  if (r.status === 'ISSUED' || r.status === 'CANCELLED') return r.status
  if (daysLeft(r.dueOn, now) < 0) return 'OVERDUE'
  return r.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'QUEUED'
}

/** Whole days until the deadline (negative when past), by calendar day in the house zone. */
export function daysLeft(dueOn: string | Date, now: Date): number {
  const day = (d: Date) => Math.floor((d.getTime() - 3 * 3_600_000) / 86_400_000)
  return day(new Date(dueOn)) - day(now)
}

export function dueLabel(dueOn: string | Date, now: Date, status: string): string {
  if (!isOpen(status)) return ''
  const d = daysLeft(dueOn, now)
  if (d < 0) return `${-d} ${-d === 1 ? 'dia' : 'dias'} de atraso`
  if (d === 0) return 'vence hoje'
  if (d === 1) return 'vence amanhã'
  return `vence em ${d} dias`
}

/** Team (total scope) assigns, moves the deadline and cancels. */
export const canManage = (a: Actor) => hasTotalScope(a.profile)
/** An appraiser takes an open request nobody holds; the team takes nothing (it assigns). */
export const canTake = (a: Actor, r: DeskRow) => a.profile === 'appraiser' && isOpen(r.status) && r.assignedAppraiserId === null
export const canAssign = (a: Actor, r: DeskRow) => canManage(a) && isOpen(r.status)
export const canCancel = (a: Actor, r: DeskRow) => canManage(a) && isOpen(r.status)
/** Issue: the assigned appraiser, an appraiser on an unassigned request (issuing takes it), or the team. */
export function canIssue(a: Actor, r: DeskRow): boolean {
  if (!isOpen(r.status)) return false
  if (canManage(a)) return true
  return a.profile === 'appraiser' && (r.assignedAppraiserId === null || r.assignedAppraiserId === a.userId)
}

export function matchesFilter(r: DeskRow, f: DeskFilter, me: number, now: Date): boolean {
  const st = stateOf(r, now)
  switch (f) {
    case 'open': return isOpen(r.status)
    case 'mine': return isOpen(r.status) && r.assignedAppraiserId === me
    case 'unassigned': return isOpen(r.status) && r.assignedAppraiserId === null
    case 'overdue': return st === 'OVERDUE'
    case 'issued': return st === 'ISSUED'
    case 'cancelled': return st === 'CANCELLED'
  }
}

export function kpisOf(rows: DeskRow[], now: Date) {
  const open = rows.filter((r) => isOpen(r.status))
  return {
    open: open.length,
    unassigned: open.filter((r) => r.assignedAppraiserId === null).length,
    overdue: open.filter((r) => stateOf(r, now) === 'OVERDUE').length,
    dueSoon: open.filter((r) => { const d = daysLeft(r.dueOn, now); return d >= 0 && d <= 1 }).length,
    issued: rows.filter((r) => r.status === 'ISSUED').length,
  }
}

/** A deadline typed by the team: a real calendar day, today or later, at most MAX_DUE_DAYS ahead. */
export function parseDueDay(raw: unknown, now: Date): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T12:00:00-03:00`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return null
  const delta = daysLeft(d, now)
  if (delta < 0 || delta > MAX_DUE_DAYS) return null
  return raw
}

/**
 * The range ruler under the three values (audit web-app §17): a track with the
 * min–max segment and a marker on the suggested value, as the design draws it.
 * The track runs 35 % of the span past each end, so the segment sits in the
 * middle (≈ 21 %–79 %) and a suggestion outside the range still shows where it
 * fell (clamped to the track). Null while min and max do not make a range.
 */
export function rangeRuler(min: number, suggested: number, max: number): { left: number; right: number; marker: number | null } | null {
  if (!(min > 0) || !(max > min)) return null
  const pad = (max - min) * 0.35
  const lo = min - pad, span = max + pad - lo
  const at = (v: number) => Math.round(Math.max(0, Math.min(100, ((v - lo) / span) * 100)) * 10) / 10
  return { left: at(min), right: Math.round((100 - at(max)) * 10) / 10, marker: suggested > 0 ? at(suggested) : null }
}

/** "48000" → "R$ 48.000" for the money inputs (digits in, digits kept in state). */
export const reaisInput = (digits: string) => (digits ? `R$ ${Number(digits).toLocaleString('pt-BR')}` : '')
