import { describe, expect, it } from 'vitest'
// Import RELATIVO de propósito: o vitest do repo não resolve o alias '@/'.
import { acessoLiberado, bearerValido, decidirAcessoJob, type ContextoJob } from './auth-core'

const SECRET = 'secret-de-teste-bem-comprido-123'

/** Contexto padrão: produção, com secret, sem staff e sem header. */
const ctx = (over: Partial<ContextoJob> = {}): ContextoJob => ({
  secret: SECRET,
  authorization: null,
  staff: false,
  metodo: 'POST',
  producao: true,
  ...over,
})

describe('bearerValido', () => {
  it('aceita o header exato que a Vercel injeta', () => {
    expect(bearerValido(SECRET, `Bearer ${SECRET}`)).toBe(true)
  })

  it('recusa secret errado, prefixo errado, header ausente e vazio', () => {
    expect(bearerValido(SECRET, 'Bearer outro-secret-qualquer-1234')).toBe(false)
    expect(bearerValido(SECRET, `Basic ${SECRET}`)).toBe(false)
    expect(bearerValido(SECRET, SECRET)).toBe(false)
    expect(bearerValido(SECRET, null)).toBe(false)
    expect(bearerValido(SECRET, '')).toBe(false)
  })

  it('recusa quando não há secret configurado, mesmo com header plausível', () => {
    expect(bearerValido(undefined, 'Bearer ')).toBe(false)
    expect(bearerValido('', 'Bearer ')).toBe(false)
    expect(bearerValido(undefined, 'Bearer undefined')).toBe(false)
  })

  it('recusa header de tamanho diferente sem estourar o timingSafeEqual', () => {
    // timingSafeEqual lança se os buffers têm tamanhos diferentes — o guard de
    // comprimento tem que vir antes.
    expect(() => bearerValido(SECRET, 'Bearer x')).not.toThrow()
    expect(bearerValido(SECRET, 'Bearer x')).toBe(false)
    expect(bearerValido(SECRET, `Bearer ${SECRET}extra`)).toBe(false)
  })

  it('não confunde acentuação/multibyte de mesmo comprimento em caracteres', () => {
    expect(bearerValido('ação', 'Bearer acao')).toBe(false)
  })
})

describe('decidirAcessoJob — a regressão que abriu as rotas', () => {
  it('PRODUÇÃO SEM SECRET NEGA (era o bug: `if (!secret) return true`)', () => {
    expect(decidirAcessoJob(ctx({ secret: undefined }))).toBe('negado')
    expect(decidirAcessoJob(ctx({ secret: '' }))).toBe('negado')
    // Nem inventando um header o anônimo entra.
    expect(decidirAcessoJob(ctx({ secret: undefined, authorization: 'Bearer qualquer' }))).toBe('negado')
  })

  it('produção com secret nega quem não manda o Bearer certo', () => {
    expect(decidirAcessoJob(ctx())).toBe('negado')
    expect(decidirAcessoJob(ctx({ authorization: 'Bearer chute' }))).toBe('negado')
  })

  it('dev/test sem secret continua liberado (não atrapalha o local)', () => {
    expect(decidirAcessoJob(ctx({ secret: undefined, producao: false }))).toBe('dev-sem-secret')
  })

  it('dev COM secret exige o Bearer — não cai no atalho de dev', () => {
    expect(decidirAcessoJob(ctx({ producao: false }))).toBe('negado')
    expect(decidirAcessoJob(ctx({ producao: false, authorization: `Bearer ${SECRET}` }))).toBe('bearer')
  })
})

describe('decidirAcessoJob — credenciais aceitas', () => {
  it('o Bearer do cron passa em produção', () => {
    expect(decidirAcessoJob(ctx({ authorization: `Bearer ${SECRET}` }))).toBe('bearer')
  })

  it('staff logado passa sem Bearer (botão "Processar agora" do /backoffice/sienge)', () => {
    expect(decidirAcessoJob(ctx({ staff: true }))).toBe('staff')
    // Inclusive quando não há secret configurado em produção.
    expect(decidirAcessoJob(ctx({ secret: undefined, staff: true }))).toBe('staff')
  })

  it('a sessão de staff NÃO libera GET/HEAD: um link aberto pela equipe não dispara job (CSRF)', () => {
    expect(decidirAcessoJob(ctx({ staff: true, metodo: 'GET' }))).toBe('negado')
    expect(decidirAcessoJob(ctx({ staff: true, metodo: 'HEAD' }))).toBe('negado')
    // o cron segue por GET com o Bearer
    expect(decidirAcessoJob(ctx({ metodo: 'GET', authorization: `Bearer ${SECRET}` }))).toBe('bearer')
  })

  it('o Bearer tem precedência sobre a sessão — o cron não depende do banco', () => {
    expect(decidirAcessoJob(ctx({ authorization: `Bearer ${SECRET}`, staff: true }))).toBe('bearer')
  })

  it('acessoLiberado espelha a decisão', () => {
    expect(acessoLiberado(ctx())).toBe(false)
    expect(acessoLiberado(ctx({ secret: undefined }))).toBe(false)
    expect(acessoLiberado(ctx({ authorization: `Bearer ${SECRET}` }))).toBe(true)
    expect(acessoLiberado(ctx({ staff: true }))).toBe(true)
    expect(acessoLiberado(ctx({ secret: undefined, producao: false }))).toBe(true)
  })
})
