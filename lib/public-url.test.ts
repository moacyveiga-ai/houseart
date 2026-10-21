import { describe, expect, it } from 'vitest'
import { publicBaseUrl, publicUrlHosts, PUBLIC_URL_DEV, declaredPublicUrl } from './public-url'

describe('publicBaseUrl', () => {
  it('APP_URL primeiro, depois NEXT_PUBLIC_APP_URL — sem barra final', () => {
    expect(publicBaseUrl({ APP_URL: 'https://hb.app/', NEXT_PUBLIC_APP_URL: 'https://outra' })).toBe('https://hb.app')
    expect(publicBaseUrl({ NEXT_PUBLIC_APP_URL: 'https://outra/' })).toBe('https://outra')
  })
  it('sem env explícita cai na URL de produção da Vercel (https)', () => {
    expect(publicBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'houseart.vercel.app' })).toBe('https://houseart.vercel.app')
    expect(publicBaseUrl({ APP_URL: '  ', VERCEL_PROJECT_PRODUCTION_URL: 'houseart.vercel.app' })).toBe('https://houseart.vercel.app')
  })
  it('sem nada: localhost:3007, nunca vazio', () => {
    expect(publicBaseUrl({})).toBe(PUBLIC_URL_DEV)
    expect(publicBaseUrl({ APP_URL: '', NEXT_PUBLIC_APP_URL: '', VERCEL_PROJECT_PRODUCTION_URL: '' })).toBe('http://localhost:3008')
  })
  it('NEXT_PUBLIC_BASE_URL (nome aposentado) não é lido — nem como reserva', () => {
    expect(publicBaseUrl({ NEXT_PUBLIC_BASE_URL: 'https://antiga', VERCEL_PROJECT_PRODUCTION_URL: 'hb.vercel.app' })).toBe('https://hb.vercel.app')
  })
})

describe('declaredPublicUrl', () => {
  it('mesma precedência, mas sem nada declarado é null — nunca localhost', () => {
    expect(declaredPublicUrl({})).toBeNull()
    expect(declaredPublicUrl({ APP_URL: ' ' })).toBeNull()
    expect(declaredPublicUrl({ APP_URL: 'https://hb.app/' })).toBe('https://hb.app')
    expect(declaredPublicUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'hb.vercel.app' })).toBe('https://hb.vercel.app')
  })
  it('nome em branco não mascara o seguinte', () => {
    expect(declaredPublicUrl({ APP_URL: '  ', NEXT_PUBLIC_APP_URL: 'https://nova/' })).toBe('https://nova')
  })
})

describe('publicUrlHosts', () => {
  it('o host de cada nome declarado; malformada e vazia saem', () => {
    expect(publicUrlHosts({ APP_URL: 'https://HB.app/x', NEXT_PUBLIC_APP_URL: 'https://outra.app' })).toEqual(['hb.app', 'outra.app'])
    expect(publicUrlHosts({ APP_URL: 'nao é url', NEXT_PUBLIC_BASE_URL: 'https://antiga.app' })).toEqual([])
    expect(publicUrlHosts({ APP_URL: ' ' })).toEqual([])
  })
})
