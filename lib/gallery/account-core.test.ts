import { describe, expect, it } from 'vitest'
import { addressLine, planLine, splitLine } from './account-core'

describe('gallery account lines', () => {
  it('address: filled parts joined, empty profile gets the hint', () => {
    expect(addressLine({ street: 'Rua Direita, 88', district: ' ', hours: 'ter a sáb, 10h–19h' })).toBe('Rua Direita, 88 · ter a sáb, 10h–19h')
    expect(addressLine({ street: null, district: null, hours: null })).toBe('Endereço e horário de funcionamento no perfil público')
    expect(addressLine(null)).toBe('Endereço e horário de funcionamento no perfil público')
  })
  it('split: range of the gallery share, singular and empty', () => {
    expect(splitLine([{ galleryBps: 5000 }, { galleryBps: 4000 }, { galleryBps: 5000 }])).toBe('3 contratos ativos · divisão registrada nos contratos: 40–50 %')
    expect(splitLine([{ galleryBps: 5000 }])).toBe('1 contrato ativo · divisão registrada nos contratos: 50 %')
    expect(splitLine([])).toBe('Nenhum contrato registrado · a divisão é definida por artista')
  })
  it('plan: name, price and the first limited bar', () => {
    expect(planLine({ name: 'Galeria Pro', priceLabel: 'R$ 899' }, [{ label: 'Obras', used: 3, limit: null }, { label: 'Certificações', used: 18, limit: 40 }])).toBe('Galeria Pro · R$ 899/mês · 18 de 40 certificações')
    expect(planLine({ name: 'Ateliê', priceLabel: 'Grátis' }, [{ label: 'Obras', used: 3, limit: null }])).toBe('Ateliê · Grátis · 3 obras')
    expect(planLine({ name: 'Galeria', priceLabel: 'R$ 1' }, [])).toBe('Galeria · R$ 1/mês')
    expect(planLine({ name: 'Galeria', priceLabel: 'R$ 1' }, [{ label: 'Laudos', used: 0, limit: 0 }, { label: 'Obras', used: 2, limit: null }])).toBe('Galeria · R$ 1/mês · 2 obras')
    expect(planLine(null, [])).toBe('Plano, uso do mês e faturas')
  })
})
