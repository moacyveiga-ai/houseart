// ════════════════════════════════════════════════════════════════════════════
//  Relatório de erro de servidor — núcleo PURO (QA geral, bloco B, 2026-10-01)
// ────────────────────────────────────────────────────────────────────────────
//  Até aqui não havia relatório de erro nenhum: a exceção virava a tela
//  padrão do Next e uma linha solta no log, sem rota nem digest para achar.
//  Este núcleo monta UM evento por erro, numa linha JSON (o formato que um log
//  drain da Vercel indexa), e o saneia antes:
//   · rota pelo PADRÃO (`/entrar/[token]`), nunca o caminho concreto — muitos
//     links levam a credencial no próprio caminho (/entrar, /assinar, /portal,
//     /e/visita, /rede/decisao…), não só na query;
//   · erro do Prisma vai só com nome e código: a mensagem padrão despeja os
//     argumentos da chamada (nome, celular, hash de senha);
//   · CPF, CNPJ, e-mail, sequência longa de dígitos (telefone) e token longo
//     (hex/base64url/JWT) na mensagem viram marcadores; a mensagem é cortada.
//  Nenhum header sai. Stack não vai (ela fica no log nativo do runtime).
// ════════════════════════════════════════════════════════════════════════════

export interface ServerErrorEvent {
  level: 'error'
  evt: 'server_error' | 'job_error'
  at: string
  digest: string | null
  message: string
  name: string
  code: string | null
  method: string | null
  route: string | null
  routeType: string | null
  job: string | null
}

const MAX_MESSAGE = 300
/** Corte ANTES de sanear: as regex rodam no que entra, e o Next espera o relatório. */
const MAX_ENTRADA = 1000

/** CPF/CNPJ (com ou sem pontuação, colados em texto), e-mail, telefone e tokens viram marcadores. */
export function redact(text: string): string {
  // Cortado, o fim pode ser um CPF/telefone/e-mail pela metade (que nenhuma
  // regra reconhece): a cauda de caracteres de dado (até 40) sai junto e vira
  // `[…]` — nunca a mensagem inteira (apagar até o último espaço zerava texto
  // sem espaço).
  const entrada = text.length > MAX_ENTRADA
    // o teto de 40 cria um segundo corte: a cauda que for SÓ dígito e separador
    // sai inteira, sem teto (letras ficam, então texto sem espaço não zera)
    ? `${text.slice(0, MAX_ENTRADA - 20).replace(/[\w.%+\-/()@\s–—]{0,40}$/, '').replace(/[\d.\s()\-–—/+]+$/, '')}[…]`
    : text
  return entrada
    .replace(/eyJ[A-Za-z0-9_-]{1,2000}\.[A-Za-z0-9_-]{1,2000}\.[A-Za-z0-9_-]{0,2000}/g, '[jwt]')
    .replace(/[^\s@<>()[\]"',;:]{1,64}(?:@|%40)[^\s@<>()[\]"',;:]{1,255}/gi, '[email]')
    // CPF/CNPJ com fronteira de dígito: 13 dígitos seguidos são telefone, não CPF
    .replace(/(?<!\d)\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}(?!\d)/g, '[cnpj]')
    .replace(/(?<!\d)\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}(?!\d)/g, '[cpf]')
    // token (DEPOIS de CPF/CNPJ, que podem vir colados em letras): 24+ caracteres com letra E dígito (nome de módulo e palavra longa ficam)
    .replace(/(?=[A-Za-z0-9_-]{0,200}\d)(?=[A-Za-z0-9_-]{0,200}[A-Za-z])[A-Za-z0-9_-]{24,}/g, '[token]')
    // telefone: 10+ dígitos com separador de telefone (esconde também data com
    // hora e IP longo — sobra de cautela, não falta)
    .replace(/\+?\d(?:[\s().\-–—]{0,2}\d){9,}/g, '[num]')
    // celular/fixo sem DDD: 9876-5432, 98765-4321, 98765.4321, 987654321
    .replace(/(?<!\d)(?:\d{1,2}\.)?\d{4,5}[\s.\-–—]?\d{4}(?!\d)/g, '[num]')
}

/**
 * A rota que vai no evento: o PADRÃO do App Router quando o Next o dá
 * (`/assinar/[token]`); sem ele, o caminho sem query e com todo segmento
 * longo ou com dígito trocado por `:id`.
 */
export function routeOf(routePath: string | null | undefined, path: string | null | undefined): string | null {
  if (routePath) return routePath
  if (!path) return null
  const semQuery = path.split(/[?#]/)[0]
  return semQuery.split('/').map((seg) => (seg.length >= 16 || /\d/.test(seg) ? ':id' : seg)).join('/')
}

function textOf(v: unknown): string {
  try {
    return typeof v === 'string' ? v : String(v ?? '')
  } catch {
    return ''
  }
}

export function buildServerErrorEvent(
  err: unknown,
  where: { method?: string | null; path?: string | null; routePath?: string | null; routeType?: string | null; job?: string | null },
  now: Date = new Date(),
): ServerErrorEvent {
  const e = (err && typeof err === 'object' ? err : { message: textOf(err) }) as { message?: unknown; name?: unknown; digest?: unknown; code?: unknown }
  const name = textOf(e.name) || 'Error'
  const code = typeof e.code === 'string' ? e.code.slice(0, 40) : null
  // Prisma: a mensagem carrega os argumentos da chamada — só nome e código saem.
  const message = name.startsWith('PrismaClient') ? '' : redact(textOf(e.message)).slice(0, MAX_MESSAGE)
  return {
    level: 'error',
    evt: where.job ? 'job_error' : 'server_error',
    at: now.toISOString(),
    digest: typeof e.digest === 'string' ? e.digest : null,
    message,
    name,
    code,
    method: where.method ?? null,
    route: routeOf(where.routePath, where.path),
    routeType: where.routeType ?? null,
    job: where.job ?? null,
  }
}
