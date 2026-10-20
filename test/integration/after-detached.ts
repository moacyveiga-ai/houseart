// setupFile do project `integration` (vitest.config.ts): depois de CADA
// teste, espera o trabalho que o código soltou fora de request — o fallback do
// `afterResponse`, a fila de automação, a entrega a parceiros e a auditoria
// sem `await` (registro em lib/depois.ts, `detach`). Sem isso a escrita solta
// do teste anterior cruzava com o TRUNCATE do próximo (deadlock 40P01) ou
// tocava a linha de mesmo id recém-criada (RESTART IDENTITY): as falhas
// intermitentes de assinatura-codigo-antes e arquivos-privados (Lote 7e).
//
// HB_DIAG_SOLTO=1 lista no log o teste que deixou trabalho correndo.
import { afterAll, afterEach, beforeEach, expect } from 'vitest'
import { awaitDetached, detachedPending } from '@/lib/after'

afterEach(async () => {
  if (process.env.HB_DIAG_SOLTO === '1') {
    const pendente = detachedPending()
    if (pendente.length > 0) console.warn(`[solto] ${expect.getState().testPath?.split('/').pop()} › ${expect.getState().currentTestName}: ${pendente.join(', ')}`)
  }
  await awaitDetached()
})

// O afterEach deste setupFile roda DEPOIS do afterEach de cada arquivo (o
// Vitest desce os hooks de trás para frente); o beforeEach roda ANTES do
// beforeEach do arquivo — é a última porta antes do TRUNCATE do teste seguinte.
beforeEach(async () => {
  await awaitDetached()
})

afterAll(async () => {
  await awaitDetached()
})
