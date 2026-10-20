// Catraca do CICLO de imports entre módulos de lib/ (QA geral, seção 4.1 e
// 6): em 2026-10-02, 54 dos 88 módulos estavam num único ciclo, e só dois
// tinham teste de fronteira. A catraca não desfaz o ciclo — ela o CONGELA:
//
//  · uma aresta módulo → módulo que fecha (ou alarga) um ciclo e não está na
//    linha de base quebra o teste — o import novo precisa de outra forma
//    (núcleo puro, evento, injeção) ou de uma decisão explícita;
//  · uma aresta da linha de base que deixou de estar em ciclo também quebra:
//    tire-a de `baseline/cyclic-module-edges.json` (a lista só diminui);
//  · o maior componente não cresce.
//
// O import dinâmico CONTA (ver source-graph.ts): `await import` adia o
// carregamento, não o acoplamento.
import { describe, expect, it } from 'vitest'
import baseline from './baseline/cyclic-module-edges.json'
import { moduleEdges, stronglyConnected } from './source-graph'

const MAIOR_CICLO_MAXIMO = 54

describe('catraca do ciclo de imports entre módulos', () => {
  const edges = moduleEdges()
  const comp = stronglyConnected(edges)
  const emCiclo: string[] = []
  for (const [a, bs] of edges) for (const b of bs) if (comp.get(a) === comp.get(b)) emCiclo.push(`${a} -> ${b}`)
  emCiclo.sort()
  const base = new Set<string>(baseline)

  it('nenhuma aresta NOVA fecha ou alarga um ciclo', () => {
    expect(emCiclo.filter((e) => !base.has(e))).toEqual([])
  })

  it('a linha de base só diminui: aresta que saiu do ciclo sai da lista', () => {
    const atual = new Set(emCiclo)
    expect(baseline.filter((e) => !atual.has(e))).toEqual([])
  })

  it(`o maior ciclo não passa de ${MAIOR_CICLO_MAXIMO} módulos`, () => {
    const tamanhos = new Map<number, number>()
    for (const c of comp.values()) tamanhos.set(c, (tamanhos.get(c) ?? 0) + 1)
    expect(Math.max(...tamanhos.values())).toBeLessThanOrEqual(MAIOR_CICLO_MAXIMO)
  })
})
