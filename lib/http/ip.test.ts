import { describe, expect, it } from 'vitest'
import { MAX_IP, ipDe, ipDeCabecalhos, normalizarIp, ultimoValor } from './ip'

const h = (o: Record<string, string>) => new Headers(o)

describe('ultimoValor', () => {
  it('devolve o ÚLTIMO valor não vazio da lista; vazio/null → null', () => {
    expect(ultimoValor('1.1.1.1, 2.2.2.2, 3.3.3.3')).toBe('3.3.3.3')
    expect(ultimoValor(' 9.9.9.9 ,  , ')).toBe('9.9.9.9')
    expect(ultimoValor('')).toBeNull()
    expect(ultimoValor(null)).toBeNull()
    expect(ultimoValor(' , ')).toBeNull()
  })
})

describe('ipDeCabecalhos / ipDe', () => {
  it('x-forwarded-for: lê o ÚLTIMO salto (o do proxy), nunca o primeiro (o que o cliente escreve)', () => {
    expect(ipDeCabecalhos(h({ 'x-forwarded-for': '1.2.3.4, 2.2.2.2' }))).toBe('2.2.2.2')
    expect(ipDeCabecalhos(h({ 'x-forwarded-for': '1.2.3.4' }))).toBe('1.2.3.4')
  })

  it('x-vercel-forwarded-for vence o último salto de x-forwarded-for, que vence x-real-ip (o cliente pode escrever x-real-ip)', () => {
    expect(ipDeCabecalhos(h({ 'x-real-ip': '1.1.1.1', 'x-vercel-forwarded-for': '3.3.3.3', 'x-forwarded-for': '9.9.9.9, 2.2.2.2' }))).toBe('3.3.3.3')
    expect(ipDeCabecalhos(h({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9, 2.2.2.2' }))).toBe('2.2.2.2')
    expect(ipDeCabecalhos(h({ 'x-real-ip': '1.1.1.1' }))).toBe('1.1.1.1')
  })

  it('cabeçalho presente mas vazio cai para o próximo da precedência', () => {
    expect(ipDeCabecalhos(h({ 'x-vercel-forwarded-for': '', 'x-forwarded-for': '5.5.5.5' }))).toBe('5.5.5.5')
  })

  it('IPv6 entra pelo prefixo /64 (2^64 endereços por cliente não viram 2^64 baldes)', () => {
    expect(normalizarIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64')
    expect(normalizarIp('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64')
    expect(normalizarIp('2001:db8:1:2::9')).toBe(normalizarIp('2001:db8:1:2:ffff::1'))
    expect(normalizarIp('::1')).toBe('0:0:0:0::/64')
    expect(normalizarIp('::ffff:10.0.0.7')).toBe('10.0.0.7')
    expect(normalizarIp('10.0.0.7')).toBe('10.0.0.7')
    expect(ipDeCabecalhos(h({ 'x-forwarded-for': '2001:db8:1:2:aaaa:bbbb:cccc:dddd' }))).toBe('2001:db8:1:2::/64')
  })

  it('sem cabeçalho nenhum o balde é único: sem-ip', () => {
    expect(ipDeCabecalhos(h({}))).toBe('sem-ip')
  })

  it(`corta em ${MAX_IP} caracteres — a chave do limitador não vira vetor de memória`, () => {
    expect(MAX_IP).toBe(120)
    expect(ipDeCabecalhos(h({ 'x-forwarded-for': 'x'.repeat(500) }))).toHaveLength(MAX_IP)
  })

  it('ipDe lê o mesmo de qualquer objeto com headers (NextRequest, Request)', () => {
    expect(ipDe({ headers: h({ 'x-real-ip': '4.4.4.4' }) })).toBe('4.4.4.4')
    expect(ipDe(new Request('http://x', { headers: { 'x-forwarded-for': 'a, b' } }))).toBe('b')
  })
})
