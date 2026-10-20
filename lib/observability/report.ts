// Relatório de erro de servidor — I/O. Núcleo e regras em ./report-core.ts.
//
// Sempre escreve a linha JSON no log (é o que um log drain da Vercel pega).
// Com ERROR_REPORT_WEBHOOK_URL configurada, também faz POST do MESMO evento
// para lá (um webhook de canal, um coletor próprio). Sentry é decisão do
// Moacy (conta e DSN); quando existir, entra aqui sem mexer nos chamadores.
// Nunca lança: relatar erro não pode virar um segundo erro.
import { buildServerErrorEvent } from './report-core'

// O Next ESPERA `onRequestError` antes de relançar o erro: o POST não pode
// segurar a resposta de erro (queda do banco = toda requisição esperando), e
// um canal de webhook aceita ~1/s. Timeout curto + uma vez por rota/digest a
// cada minuto, por instância.
const WEBHOOK_TIMEOUT_MS = 1000
const DEDUPE_MS = 60_000
const recentes = new Map<string, number>()

// Teto GLOBAL por minuto: numa tempestade cada erro tem digest próprio, e o
// dedupe por chave sozinho mandaria um POST por erro.
const TETO_POR_MINUTO = 20
let janela = { inicio: 0, enviados: 0 }

function jaRelatado(chave: string, agora: number): boolean {
  const t = recentes.get(chave)
  if (t != null && agora - t < DEDUPE_MS) return true
  if (agora - janela.inicio >= DEDUPE_MS) janela = { inicio: agora, enviados: 0 }
  if (janela.enviados >= TETO_POR_MINUTO) return true
  janela.enviados++
  recentes.set(chave, agora)
  if (recentes.size > 500) for (const [k, v] of recentes) if (agora - v >= DEDUPE_MS) recentes.delete(k)
  return false
}

export async function reportServerError(
  err: unknown,
  where: { method?: string | null; path?: string | null; routePath?: string | null; routeType?: string | null; job?: string | null },
): Promise<void> {
  let event
  try {
    event = buildServerErrorEvent(err, where)
    console.error(JSON.stringify(event))
  } catch {
    return // relatar não pode virar um segundo erro
  }
  const url = (process.env.ERROR_REPORT_WEBHOOK_URL ?? '').trim()
  if (!url.startsWith('https://')) return
  if (jaRelatado(`${event.route ?? event.job ?? ''}|${event.digest ?? event.name}`, Date.now())) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    })
  } catch {
    // o coletor fora do ar não derruba nada; a linha do log já saiu
  }
}
