import { describe, expect, it } from 'vitest'
import { baseUrlPublica, hostsDaUrlPublica, URL_PUBLICA_DEV, urlPublicaDeclarada } from './public-url'

describe('baseUrlPublica', () => {
  it('APP_URL primeiro, depois NEXT_PUBLIC_APP_URL — sem barra final', () => {
    expect(baseUrlPublica({ APP_URL: 'https://hb.app/', NEXT_PUBLIC_APP_URL: 'https://outra' })).toBe('https://hb.app')
    expect(baseUrlPublica({ NEXT_PUBLIC_APP_URL: 'https://outra/' })).toBe('https://outra')
  })
  it('sem env explícita cai na URL de produção da Vercel (https)', () => {
    expect(baseUrlPublica({ VERCEL_PROJECT_PRODUCTION_URL: 'housebroker.vercel.app' })).toBe('https://housebroker.vercel.app')
    expect(baseUrlPublica({ APP_URL: '  ', VERCEL_PROJECT_PRODUCTION_URL: 'housebroker.vercel.app' })).toBe('https://housebroker.vercel.app')
  })
  it('sem nada: localhost:3007, nunca vazio', () => {
    expect(baseUrlPublica({})).toBe(URL_PUBLICA_DEV)
    expect(baseUrlPublica({ APP_URL: '', NEXT_PUBLIC_APP_URL: '', VERCEL_PROJECT_PRODUCTION_URL: '' })).toBe('http://localhost:3007')
  })
  it('NEXT_PUBLIC_BASE_URL (nome aposentado) não é lido — nem como reserva', () => {
    expect(baseUrlPublica({ NEXT_PUBLIC_BASE_URL: 'https://antiga', VERCEL_PROJECT_PRODUCTION_URL: 'hb.vercel.app' })).toBe('https://hb.vercel.app')
  })
})

describe('urlPublicaDeclarada', () => {
  it('mesma precedência, mas sem nada declarado é null — nunca localhost', () => {
    expect(urlPublicaDeclarada({})).toBeNull()
    expect(urlPublicaDeclarada({ APP_URL: ' ' })).toBeNull()
    expect(urlPublicaDeclarada({ APP_URL: 'https://hb.app/' })).toBe('https://hb.app')
    expect(urlPublicaDeclarada({ VERCEL_PROJECT_PRODUCTION_URL: 'hb.vercel.app' })).toBe('https://hb.vercel.app')
  })
  it('nome em branco não mascara o seguinte', () => {
    expect(urlPublicaDeclarada({ APP_URL: '  ', NEXT_PUBLIC_APP_URL: 'https://nova/' })).toBe('https://nova')
  })
})

describe('hostsDaUrlPublica', () => {
  it('o host de cada nome declarado; malformada e vazia saem', () => {
    expect(hostsDaUrlPublica({ APP_URL: 'https://HB.app/x', NEXT_PUBLIC_APP_URL: 'https://outra.app' })).toEqual(['hb.app', 'outra.app'])
    expect(hostsDaUrlPublica({ APP_URL: 'nao é url', NEXT_PUBLIC_BASE_URL: 'https://antiga.app' })).toEqual([])
    expect(hostsDaUrlPublica({ APP_URL: ' ' })).toEqual([])
  })
})
