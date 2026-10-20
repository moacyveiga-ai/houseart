import { describe, it, expect } from 'vitest'
import { FUSO_BR, noFuso, dataBR, dataCurtaBR, horaBR, dataHoraBR, dataHoraCurtaBR, instanteDoDia, fimDoDia } from './timezone'

/** Roda `fn` com o processo em outro fuso — é assim que se prova que a régua
 *  NÃO depende da máquina de quem executa. Mesmo helper de lib/datas.test.ts. */
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

// O caso do HMAP-5: visita marcada às 21:03 de 18/07 no horário de Brasília.
// No banco isso é 00:03 UTC do dia 19 — e é exatamente esse instante que o
// servidor recebe de volta.
const VISITA_21H03 = '2026-07-19T00:03:00.000Z'

describe('fuso de exibição', () => {
  it('a visita das 21:03 continua sendo 21:03, e do dia certo', () => {
    expect(horaBR(VISITA_21H03)).toBe('21:03')
    expect(dataBR(VISITA_21H03)).toBe('18/07/2026')
    expect(dataHoraCurtaBR(VISITA_21H03)).toBe('18/07, 21:03')
  })

  it('não muda quando o servidor roda em UTC — que é o caso da Vercel', () => {
    comFuso('UTC', () => {
      expect(horaBR(VISITA_21H03)).toBe('21:03')
      expect(dataBR(VISITA_21H03)).toBe('18/07/2026')
    })
  })

  it('nem quando roda do outro lado do mundo', () => {
    comFuso('Asia/Tokyo', () => {
      expect(horaBR(VISITA_21H03)).toBe('21:03')
      expect(dataBR(VISITA_21H03)).toBe('18/07/2026')
    })
  })

  it('sem a régua, o mesmo instante mente — é o bug que o ticket relatou', () => {
    const semRegua = comFuso('UTC', () =>
      new Date(VISITA_21H03).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    )
    // 19/07 às 00:03: o dia seguinte, três horas adiantado.
    expect(semRegua).toContain('19/07')
    expect(semRegua).toContain('00:03')
    // A régua, no mesmo processo em UTC, acerta.
    expect(comFuso('UTC', () => dataHoraCurtaBR(VISITA_21H03))).toContain('18/07')
  })

  it('atalhos cobrem os recortes que as telas usam', () => {
    expect(dataCurtaBR(VISITA_21H03)).toBe('18/07/26')
    expect(dataHoraBR(VISITA_21H03)).toBe('18/07/2026, 21:03')
    expect(noFuso(VISITA_21H03, { weekday: 'long' })).toBe('sábado')
  })

  it('vazio e lixo viram o traço, não "Invalid Date"', () => {
    expect(dataBR(null)).toBe('—')
    expect(dataBR(undefined)).toBe('—')
    expect(dataBR('')).toBe('—')
    expect(horaBR('nao é data')).toBe('—')
    expect(dataBR(null, 'sem data')).toBe('sem data')
  })

  it('o fuso escolhido não observa horário de verão', () => {
    expect(FUSO_BR).toBe('America/Bahia')
    const janeiro = new Date('2026-01-15T15:00:00.000Z')
    const julho = new Date('2026-07-15T15:00:00.000Z')
    // Mesma hora UTC nos dois hemisférios do ano → mesma hora de parede.
    expect(horaBR(janeiro)).toBe(horaBR(julho))
  })
})

describe('instanteDoDia e fimDoDia: dia de calendário que não existe', () => {
  it('31 de fevereiro e 31 de abril não viram março e maio', () => {
    expect(instanteDoDia('2026-02-31')).toBeNull()
    expect(instanteDoDia('2026-04-31', 0)).toBeNull()
    expect(fimDoDia('2026-02-30')).toBeNull()
  })
  it('29 de fevereiro só em ano bissexto', () => {
    expect(instanteDoDia('2026-02-29')).toBeNull()
    expect(instanteDoDia('2028-02-29', 0)).toBe('2028-02-29T03:00:00.000Z')
  })
  it('dia de verdade segue igual', () => {
    expect(instanteDoDia('2026-10-18', 0)).toBe('2026-10-18T03:00:00.000Z')
    expect(fimDoDia('2026-10-31')?.toISOString()).toBe('2026-11-01T02:59:59.999Z')
  })
})
