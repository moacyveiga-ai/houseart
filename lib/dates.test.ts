import { describe, it, expect } from 'vitest'
import { diaLocalDe, formatarDiaBR } from './dates'

/**
 * O bug só EXISTE em fuso negativo — num runner em UTC a meia-noite UTC já é o
 * dia certo e qualquer teste passa com ou sem a régua. Por isso o fuso é
 * fixado aqui dentro, e não herdado da máquina.
 */
function comFuso<T>(tz: string, fn: () => T): T {
  const anterior = process.env.TZ
  process.env.TZ = tz
  try {
    return fn()
  } finally {
    if (anterior === undefined) delete process.env.TZ
    else process.env.TZ = anterior
  }
}

/** Exatamente como o banco devolve: `new Date("2026-08-11")` do <input type="date">. */
const VENC_UTC = () => new Date('2026-08-11T00:00:00.000Z')

describe('diaLocalDe', () => {
  it('no Brasil, traz a meia-noite UTC para a meia-noite LOCAL do MESMO dia', () => {
    comFuso('America/Sao_Paulo', () => {
      // O bug que estamos consertando: sem a régua, os getters locais mentem.
      expect(VENC_UTC().getDate()).toBe(10)

      const d = diaLocalDe(VENC_UTC())
      expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 8, 11])
      expect([d.getHours(), d.getMinutes()]).toEqual([0, 0])
    })
  })

  it('em UTC é identidade — a régua não estraga quem já estava certo', () => {
    comFuso('UTC', () => {
      expect(diaLocalDe(VENC_UTC()).getTime()).toBe(VENC_UTC().getTime())
    })
  })

  it('em fuso positivo mantém o dia de calendário', () => {
    comFuso('Asia/Tokyo', () => {
      expect(diaLocalDe(VENC_UTC()).getDate()).toBe(11)
    })
  })

  it('é idempotente: aplicar duas vezes não move o dia de novo', () => {
    comFuso('America/Sao_Paulo', () => {
      const uma = diaLocalDe(VENC_UTC())
      expect(diaLocalDe(uma).getTime()).toBe(uma.getTime())
    })
  })
})

describe('formatarDiaBR', () => {
  it('mostra o dia do vencimento, não o anterior', () => {
    comFuso('America/Sao_Paulo', () => {
      // O que as telas faziam antes e mostrava 10/08:
      expect(VENC_UTC().toLocaleDateString('pt-BR')).toBe('10/08/2026')
      expect(formatarDiaBR(VENC_UTC())).toBe('11/08/2026')
      expect(formatarDiaBR('2026-08-11T00:00:00.000Z')).toBe('11/08/2026')
    })
  })

  it('mesmo resultado num navegador em UTC', () => {
    comFuso('UTC', () => {
      expect(formatarDiaBR('2026-08-11T00:00:00.000Z')).toBe('11/08/2026')
    })
  })

  it('vazio e data inválida caem no placeholder', () => {
    expect(formatarDiaBR(null)).toBe('—')
    expect(formatarDiaBR('')).toBe('—')
    expect(formatarDiaBR(undefined)).toBe('—')
    expect(formatarDiaBR('não é data')).toBe('—')
    expect(formatarDiaBR(null, '')).toBe('')
  })
})
