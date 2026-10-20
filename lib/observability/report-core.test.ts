import { describe, expect, it } from 'vitest'
import { buildServerErrorEvent, redact, routeOf } from './report-core'

describe('relatório de erro de servidor', () => {
  it('a rota vai pelo PADRÃO: token no caminho nunca sai', () => {
    expect(routeOf('/assinar/[token]', '/assinar/AbCdEf123456789xyz')).toBe('/assinar/[token]')
    expect(routeOf(null, '/redefinir-senha/AbCdEfGhIjKlMnOpQr?x=1')).toBe('/redefinir-senha/:id')
    expect(routeOf(null, '/artworks/123/edit')).toBe('/artworks/:id/edit')
    expect(routeOf(null, null)).toBeNull()
  })

  it('CPF, CNPJ, e-mail (inclusive com acento), telefone e token viram marcadores', () => {
    expect(redact('cpf 529.982.247-25 e cpf52998224725 e user_52998224725')).not.toMatch(/\d{5}/)
    expect(redact('CPF 529 982 247 25')).toBe('CPF [cpf]')
    expect(redact('cnpj=11.222.333/0001-81')).toBe('cnpj=[cnpj]')
    expect(redact('para joão.silva@exemplo.com.br falhou')).toBe('para [email] falhou')
    expect(redact('tel 5511987654321 ou +55 (11) 98765-4321')).not.toMatch(/\d{4}/)
    expect(redact('token 0123456789abcdef0123456789abcdef')).toBe('token [token]')
    expect(redact('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc')).toBe('[jwt]')
  })

  it('celular sem DDD, e-mail codificado e CPF cortado pela metade não saem', () => {
    expect(redact('ligue 98765-4321 ou 9876-5432 ou 98765–4321')).toBe('ligue [num] ou [num] ou [num]')
    expect(redact('para joao%40ex.com.br')).toBe('para [email]')
    const longo = 'x '.repeat(497) + 'cpf 123.456.789-09'
    expect(redact(longo)).not.toMatch(/123\.456/)
    // e o corte nunca apaga a mensagem inteira
    expect(redact('erro: 123.456.789-09' + 'y'.repeat(2000))).toMatch(/^erro: \[cpf\]y+/)
    expect(redact('z'.repeat(1016)).length).toBeGreaterThan(900)
    expect(redact('tel 98765.4321 ou 987654321')).toBe('tel [num] ou [num]')
    // o caso da revisão (rodada 6): CPF cruzando o segundo corte, o do teto de 40
    expect(redact('x1'.repeat(464) + ' ' + '123.456.789-01' + 'b'.repeat(100))).not.toMatch(/123\.456|456\.789/)
    expect(redact('x1'.repeat(464) + ' (11) 98765-4321' + 'b'.repeat(100))).not.toMatch(/98765/)
    // corte caindo NO MEIO do dado: nada do pedaço sobra
    for (const dado of ['123.456.789-09', '12.345.678/0001-81', '(11) 98765-4321', 'fulano.silva@ex.com']) {
      for (let k = 2; k < dado.length; k++) {
        const t = 'x'.repeat(980 - k) + dado + ' fim'.repeat(20)
        expect(redact(t), `${dado} cortado em ${k}`).not.toContain(dado.slice(0, k))
      }
    }
  })

  it('não sanei demais: data ISO, IP, nome de módulo e código P2002 ficam', () => {
    expect(redact('em 2026-10-01T12:00:00.000Z')).toBe('em 2026-10-01T12:00:00.000Z')
    expect(redact('conexão 192.168.0.12:5432 recusada')).toBe('conexão 192.168.0.12:5432 recusada')
    expect(redact('job housecredito-hub-sincronizar caiu (P2002)')).toBe('job housecredito-hub-sincronizar caiu (P2002)')
  })

  it('mensagem enorme sem espaço não trava (o corte vem antes)', () => {
    const t0 = Date.now()
    redact('a'.repeat(200_000) + '@' + 'b'.repeat(200_000))
    redact('eyJ'.repeat(100_000))
    expect(Date.now() - t0).toBeLessThan(500)
  })

  it('erro do Prisma sai só com nome e código (a mensagem tem os argumentos)', () => {
    const err = Object.assign(new Error('Invalid prisma.usuario.create() { nome: "Ana", celular: "71999990000", senhaHash: "$2b$..." }'), { name: 'PrismaClientValidationError', code: 'P2002' })
    const ev = buildServerErrorEvent(err, { routePath: '/api/x', routeType: 'route' })
    expect(ev).toMatchObject({ name: 'PrismaClientValidationError', code: 'P2002', message: '' })
    expect(JSON.stringify(ev)).not.toContain('Ana')
  })

  it('monta o evento com digest e mensagem cortada; não lança com mensagem estranha', () => {
    const err = Object.assign(new Error('x'.repeat(500)), { digest: 'D123' })
    const ev = buildServerErrorEvent(err, { method: 'POST', path: '/api/propostas/7?token=s', routePath: '/api/propostas/[id]', routeType: 'route' }, new Date('2026-10-01T12:00:00Z'))
    expect(ev).toMatchObject({ evt: 'server_error', digest: 'D123', method: 'POST', route: '/api/propostas/[id]', routeType: 'route', job: null })
    expect(ev.message.length).toBeLessThanOrEqual(300)
    expect(JSON.stringify(ev)).not.toContain('token=s')
    const esquisito = { message: { toString() { throw new Error('boom') } } }
    expect(() => buildServerErrorEvent(esquisito, {})).not.toThrow()
  })

  it('erro de job é job_error e aceita o que não é Error', () => {
    expect(buildServerErrorEvent('falhou', { job: 'billing-diario' })).toMatchObject({ evt: 'job_error', job: 'billing-diario', message: 'falhou', digest: null })
  })
})

describe('varredura de posições de corte (revisão adversarial, bloco B)', () => {
  it('nenhum prefixo de 6+ dígitos de CPF, CNPJ ou telefone sobra com o dado em qualquer posição perto dos cortes', () => {
    const dados = ['123.456.789-01', '12345678901', '(11) 98765-4321', '12.345.678/0001-81']
    const vazou: string[] = []
    for (const d of dados) for (const pre of ['ab', 'a ']) for (let pos = 900; pos < 1000; pos++) {
      const r = redact(pre.repeat(pos).slice(0, pos) + ' ' + d + 'b'.repeat(200))
      const dig = d.replace(/\D/g, '')
      if (r.replace(/\D/g, '').includes(dig.slice(0, 6))) vazou.push(`${d} em ${pos} (${JSON.stringify(pre)})`)
    }
    expect(vazou).toEqual([])
  })
})
