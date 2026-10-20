// ════════════════════════════════════════════════════════════════════════════
//  TRABALHO DEPOIS DA RESPOSTA — para o aviso sobreviver ao fim do request
// ────────────────────────────────────────────────────────────────────────────
//  Portado do houserent (lib/depois.ts) no bloco B do QA geral do Housebroker
//  (2026-10-01): o relatório achou ~20 `void avisar…()` e dezenas de
//  `.catch(() => {})` soltos aqui também. O nome é o do houserent de propósito
//  — o mesmo helper nos dois repositórios, e os `afterResponse` locais que
//  já existiam (na base de origem)
//  tinham este nome. O contexto de escopo (lib/escopo/contexto.ts) sobrevive
//  ao `after()`: a consulta adiada continua recortada.
//
//  Achado em produção, 2026-09-05, no primeiro teste ponta a ponta com SMTP
//  no ar: a proposta foi enviada, a trilha gravou a transição, e o carimbo de
//  auditoria do aviso nunca gravou. Investigando, a função tinha rodado quase
//  inteira — a tarefa nasceu, o e-mail saiu — e foi cortada na última escrita.
//  Truncamento, não perda: com um SMTP mais lento o corte cai mais cedo e
//  alguém deixa de ser avisado, sem erro e sem log.
//
//  A causa não estava no e-mail. Estava no `void`:
//
//      void avisarPropostaEnviada(p, base)   // ← promessa solta
//      return { ok: true }
//
//  Em dev isso funciona, porque o `next dev` é um processo que fica de pé e a
//  promessa termina sozinha. Em produção cada rota é uma função que CONGELA
//  assim que devolve a resposta — a promessa solta morre no meio, sem erro,
//  sem log. O caminho feliz responde 200 e o aviso simplesmente não existe.
//  É a pior forma de falha: silenciosa e só em produção.
//
//  ── O conserto ────────────────────────────────────────────────────────────
//
//  `after` do Next agenda trabalho para DEPOIS da resposta, dentro do tempo da
//  rota (as nossas declaram `maxDuration`). O usuário continua sem esperar o
//  SMTP, e a plataforma sabe que ainda há o que fazer antes de congelar.
//
//  Fora de um request — script, seed, teste — `after` lança de propósito. Aí
//  o fallback roda solto mesmo, que é o certo nesses contextos: quem chama de
//  um script tem um processo vivo esperando.
//
//  ── Por que engolir o erro ────────────────────────────────────────────────
//
//  O aviso é best-effort por desenho: o fato que ele anuncia JÁ aconteceu
//  quando ele roda, e um SMTP fora do ar não pode desfazer a proposta enviada
//  nem a vistoria concluída. O que não pode é falhar em silêncio — por isso o
//  erro vai para o log com o rótulo de quem falhou.
//
//  ── Onde isto vale ────────────────────────────────────────────────────────
//
//  Em TODO efeito colateral que a resposta não espera: e-mail, push, tarefa,
//  carimbo de telemetria. `lib/depois.test.ts` varre o repositório e recusa
//  `void avisar…` e chamada solta de notificação em qualquer módulo.
// ════════════════════════════════════════════════════════════════════════════
import { after } from 'next/server'

// ── Trabalho solto fora de request ─────────────────────────────────────────
// Fora de request (script, cron chamado à mão, teste) o trabalho adiado roda
// SOLTO. Ele fica registrado aqui para quem precisa esperar por ele: o
// afterEach global dos testes de integração (test/integration/esperar-solto.ts)
// espera antes do TRUNCATE do próximo teste — sem isso, uma escrita solta do
// teste anterior cruzava com o TRUNCATE (deadlock 40P01) ou tocava a linha de
// mesmo id que o teste seguinte acabara de criar (RESTART IDENTITY). O
// registro mora no `globalThis` porque um `vi.mock` do módulo cria outra
// instância dele. Em request nada passa por aqui: o `after()` do Next segura.
const CHAVE_SOLTO = Symbol.for('houseart.detachedWork')

function registroSolto(): Map<Promise<unknown>, string> {
  const g = globalThis as { [CHAVE_SOLTO]?: Map<Promise<unknown>, string> }
  return (g[CHAVE_SOLTO] ??= new Map())
}

/**
 * Solta a promessa fora de request, registrada até terminar (nunca lança).
 * SÓ no ramo `catch` do `after()`: em request o trabalho solto morre quando a
 * função congela — lá o certo é o `after()` (catraca em lib/depois-solto.test.ts).
 */
export function detach(rotulo: string, promessa: Promise<unknown>): void {
  const registro = registroSolto()
  const vigiada: Promise<unknown> = promessa.then(() => undefined, () => undefined).finally(() => registro.delete(vigiada))
  registro.set(vigiada, rotulo)
}

/** Os rótulos do trabalho solto ainda correndo (para diagnóstico). */
export function detachedPending(): string[] {
  return [...registroSolto().values()]
}

/** Espera o trabalho solto terminar, inclusive o que nasce dele. Nunca lança. */
export async function awaitDetached(): Promise<void> {
  const registro = registroSolto()
  while (registro.size > 0) await Promise.allSettled([...registro.keys()])
}

export function afterResponse(rotulo: string, tarefa: () => Promise<unknown>): void {
  const correr = async () => {
    try {
      await tarefa()
    } catch (e) {
      console.error(`[depois] ${rotulo} falhou:`, e instanceof Error ? e.message : e)
    }
  }
  try {
    after(correr)
  } catch {
    // Sem request scope (script, cron chamado à mão, teste): não há resposta
    // para esperar, então basta detach — registrado (ver `detach`).
    detach(rotulo, correr())
  }
}

/**
 * O mesmo `afterResponse`, mas fora de request a tarefa roda JÁ e o
 * chamador espera (cron chamado à mão, script, teste): para o efeito que tem
 * de sair DEPOIS de um commit e que ninguém pode perder no `void` solto. Em
 * request, vai ao `after()` como sempre. Nunca lança.
 */
export async function afterResponseOrNow(rotulo: string, tarefa: () => Promise<unknown>): Promise<void> {
  const correr = async () => {
    try {
      await tarefa()
    } catch (e) {
      console.error(`[depois] ${rotulo} falhou:`, e instanceof Error ? e.message : e)
    }
  }
  try {
    after(correr)
  } catch {
    await correr()
  }
}

/**
 * Para a promessa que o chamador pode NÃO esperar (o padrão "fire-and-forget"
 * de `registrarAudit`/`audit.*`, chamados sem `await` em dezenas de pontos):
 * registra a promessa no `after` do Next para a função não congelar antes de
 * ela terminar, e a devolve intacta para quem quiser esperar. Fora de request
 * `after` lança e não há o que segurar. Quem passa aqui precisa já tratar o
 * próprio erro — este helper não loga nem engole nada.
 */
export function detachedSafe<T>(promessa: Promise<T>): Promise<T> {
  try {
    after(promessa.then(() => undefined, () => undefined))
  } catch {
    // sem request scope: o processo que chamou segue vivo — registrado (ver `detach`)
    detach('detachedSafe', promessa)
  }
  return promessa
}
