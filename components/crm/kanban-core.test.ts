import { describe, expect, it } from 'vitest'
import { moveCard, neighbourStage, placeOf, stageAtPoint, stageOf, type Column } from './kanban-core'

const card = (id: number, stage: Column['stage']) => ({ id, initials: 'AB', name: 'Ana', interest: '—', value: '—', when: 'hoje', stage })
const board = (): Column[] => [
  { stage: 'INTERESTED', label: 'Interessados', cards: [card(1, 'INTERESTED'), card(2, 'INTERESTED')] },
  { stage: 'IN_CONVERSATION', label: 'Em conversa', cards: [] },
  { stage: 'OFFER', label: 'Proposta', cards: [card(3, 'OFFER')] },
  { stage: 'CLOSED', label: 'Fechado', cards: [] },
]

describe('kanban-core', () => {
  it('move o cartão para o topo da coluna de destino', () => {
    const next = moveCard(board(), 2, 'OFFER')
    expect(next[0].cards.map((c) => c.id)).toEqual([1])
    expect(next[2].cards.map((c) => c.id)).toEqual([2, 3])
    expect(next[2].cards[0].stage).toBe('OFFER')
  })
  it('não muda nada quando o cartão já está na coluna ou não existe', () => {
    const b = board()
    expect(moveCard(b, 1, 'INTERESTED')).toBe(b)
    expect(moveCard(b, 99, 'OFFER')).toBe(b)
  })
  it('acha a etapa e a vizinha', () => {
    expect(stageOf(board(), 3)).toBe('OFFER')
    expect(stageOf(board(), 99)).toBeNull()
    expect(neighbourStage(board(), 'INTERESTED', -1)).toBeNull()
    expect(neighbourStage(board(), 'INTERESTED', 1)).toBe('IN_CONVERSATION')
    expect(neighbourStage(board(), 'CLOSED', 1)).toBeNull()
  })
  it('devolve o cartão à posição de antes', () => {
    const b = board()
    const where = placeOf(b, 2)!
    expect(where).toEqual({ stage: 'INTERESTED', index: 1 })
    const back = moveCard(moveCard(b, 2, 'OFFER'), 2, where.stage, where.index)
    expect(back[0].cards.map((c) => c.id)).toEqual([1, 2])
    expect(moveCard(b, 2, 'OFFER', 9)[2].cards.map((c) => c.id)).toEqual([3, 2])
  })
  it('acha a coluna pelo retângulo', () => {
    const boxes = [{ stage: 'INTERESTED' as const, left: 0, right: 100, top: 0, bottom: 500 }, { stage: 'OFFER' as const, left: 110, right: 210, top: 0, bottom: 500 }]
    expect(stageAtPoint(boxes, 150, 40)).toBe('OFFER')
    expect(stageAtPoint(boxes, 105, 40)).toBeNull()
    expect(stageAtPoint(boxes, 50, 900)).toBeNull()
  })
})
