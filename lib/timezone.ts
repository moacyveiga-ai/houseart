// ════════════════════════════════════════════════════════════════════════════
//  Fuso de exibição — a régua única para INSTANTES.
//
//  lib/datas.ts cuida do outro lado: datas de CALENDÁRIO ("vence dia 11/08"),
//  que não têm hora e por isso não têm fuso. Aqui ficam os INSTANTES — um
//  compromisso às 21:03 só vira "21:03" depois de alguém escolher o fuso.
//
//  O banco guarda tudo em UTC e o servidor da Vercel roda em UTC. Sem fuso
//  explícito, toLocaleString desenha a hora de Greenwich: a visita das 21:03
//  aparece como 00:03 do dia seguinte — o dia ERRADO. E o estrago não fica no
//  servidor: componentes 'use client' também são renderizados no servidor no
//  primeiro passe, então a hora errada chega a telas que "deveriam" usar o
//  relógio do navegador. Foi assim que o HMAP-5 apareceu no Funil do CRM.
//
//  Regra: toda exibição de hora passa por aqui. Formatar instante sem fuso
//  é bug, mesmo que a máquina de quem escreveu o código esteja em Brasília.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Fuso de exibição do produto.
 *
 * `America/Bahia` é UTC−3 e nunca observou horário de verão — se o Brasil
 * voltar a adotá-lo, esta régua não se mexe sozinha. É também o valor que a
 * Agenda já usava (FUSO_AGENDA); ele foi promovido para cá para existir UM
 * valor só no sistema, em vez de dois que podem divergir.
 */
export const FUSO_BR = 'America/Bahia'

const _cache = new Map<string, Intl.DateTimeFormat>()

function formatador(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const chave = JSON.stringify(opts)
  let f = _cache.get(chave)
  if (!f) {
    f = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_BR, ...opts })
    _cache.set(chave, f)
  }
  return f
}

/** Aceita o que o servidor devolve (ISO) ou um Date; devolve null se não for data. */
function instante(v: string | Date | null | undefined): Date | null {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Formata um instante no fuso do produto com as opções que a tela quiser.
 * Use os atalhos abaixo quando um deles servir; use este quando a tela
 * precisar de um recorte próprio (dia da semana por extenso, mês longo…).
 */
export function noFuso(
  v: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions,
  vazio = '—'
): string {
  const d = instante(v)
  return d ? formatador(opts).format(d) : vazio
}

/** "21/08/2026" */
export const dataBR = (v: string | Date | null | undefined, vazio = '—') =>
  noFuso(v, { day: '2-digit', month: '2-digit', year: 'numeric' }, vazio)

/** "21/08/26" — para tabelas apertadas. */
export const dataCurtaBR = (v: string | Date | null | undefined, vazio = '—') =>
  noFuso(v, { day: '2-digit', month: '2-digit', year: '2-digit' }, vazio)

/** "21:03" */
export const horaBR = (v: string | Date | null | undefined, vazio = '—') =>
  noFuso(v, { hour: '2-digit', minute: '2-digit' }, vazio)

/** "21/08/2026 21:03" */
export const dataHoraBR = (v: string | Date | null | undefined, vazio = '—') =>
  noFuso(v, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }, vazio)

/** "21/08 21:03" — cartão de funil, lista de conversas. */
export const dataHoraCurtaBR = (v: string | Date | null | undefined, vazio = '—') =>
  noFuso(v, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }, vazio)

/**
 * Dia escolhido num `<input type="date">` ("2026-09-04") → INSTANTE ISO à hora
 * cheia informada NO FUSO DO PRODUTO. O deslocamento é DERIVADO de `FUSO_BR`
 * (nunca escrito à mão como "-03:00"): se o Brasil voltar ao horário de verão,
 * muda só a constante acima.
 *
 * Só para INSTANTES (liquidação, pagamento). Vencimento é data de calendário —
 * esse é o outro lado da régua, em lib/datas.ts.
 */
export function instanteDoDia(dia: string, hora = 12): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia ?? '')) return null
  if (!Number.isInteger(hora) || hora < 0 || hora > 23) return null
  const base = new Date(`${dia}T${String(hora).padStart(2, '0')}:00:00Z`)
  if (Number.isNaN(base.getTime())) return null
  // o Date rola dia inexistente para o mês seguinte (31/02 → 03/03): só vale o dia que existe
  if (base.toISOString().slice(0, 10) !== dia) return null
  // Quanto o fuso do produto está atrás de UTC NAQUELE instante (3 h hoje).
  const noBr = new Date(base.toLocaleString('en-US', { timeZone: FUSO_BR }))
  const emUtc = new Date(base.toLocaleString('en-US', { timeZone: 'UTC' }))
  const deslocamentoMs = emUtc.getTime() - noBr.getTime()
  const d = new Date(base.getTime() + deslocamentoMs)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * O dia de CALENDÁRIO, no fuso do produto, de um instante: "2026-10-06".
 * É o que um `<input type="date">` mostra e o que se compara quando a regra é
 * "até o fim do dia X" (validade do mandato). O servidor roda em UTC: às 22h
 * de Brasília `toISOString().slice(0, 10)` já devolve o dia seguinte.
 */
export function diaNoFuso(v: string | Date | null | undefined): string | null {
  const d = instante(v)
  if (!d) return null
  const partes = formatador({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? ''
  return `${p('year')}-${p('month')}-${p('day')}`
}

/**
 * O último milissegundo do dia `AAAA-MM-DD` no fuso do produto (23:59:59.999
 * de Brasília = 02:59:59.999Z do dia seguinte). Para prazos "válido até o dia
 * X": gravar 23:59:59Z venceria às 20:59 do próprio dia.
 */
export function fimDoDia(dia: string): Date | null {
  const inicio = instanteDoDia(dia, 23)
  if (!inicio) return null
  return new Date(new Date(inicio).getTime() + 3_599_999)
}

/** The instant that starts the calendar year of `now` in the house timezone (UTC−3 fixed). */
export function startOfYearInTz(now: Date): Date {
  const year = Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: FUSO_BR }).format(now))
  return new Date(`${year}-01-01T03:00:00.000Z`)
}
