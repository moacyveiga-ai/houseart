// ════════════════════════════════════════════════════════════════════════════
//  Datas de CALENDÁRIO × instantes — a régua única do sistema.
//
//  Vencimento é uma DATA DE CALENDÁRIO ("vence dia 11/08"), não um instante.
//  Mas o banco guarda tudo como DateTime, e quem grava faz `new Date("2026-08-11")`
//  sobre a string do <input type="date"> — o que o JS interpreta como MEIA-NOITE
//  UTC. Lido em horário local no Brasil (UTC−3) isso vira 10/08 às 21h:
//
//    new Date("2026-08-11").getDate()  →  10   ← o dia ERRADO
//
//  O estrago aparece em toda conta que usa os getters locais: a cobrança que
//  vence HOJE entra na faixa de vencidos do aging, a tela mostra um dia a
//  menos, e um vencimento no dia 1º cai no MÊS ANTERIOR do previsto.
//
//  `diaLocalDe` normaliza na FRONTEIRA (ao ler do banco, antes de qualquer
//  conta): traz a data de calendário para a meia-noite LOCAL do MESMO dia.
//  Depois disso todo núcleo puro trabalha só com horário local e os getters
//  locais voltam a estar certos.
//
//  NÃO passe instantes de verdade por aqui — emissão, liquidação, pagamento,
//  movimento do extrato têm hora real e para eles o local já é o certo.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Data de calendário gravada em meia-noite UTC → meia-noite LOCAL do MESMO dia.
 * Use na leitura do banco, uma vez, na fronteira.
 */
export function diaLocalDe(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Data de calendário (Date ou ISO) → 'dd/mm/aaaa' pt-BR, sem escorregar um dia.
 * É o `dt()` das telas para campos de VENCIMENTO; para emissão/liquidação
 * continue formatando o instante direto.
 */
export function formatarDiaBR(v: string | Date | null | undefined, vazio = '—'): string {
  if (v == null || v === '') return vazio
  const d = typeof v === 'string' ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return vazio
  return diaLocalDe(d).toLocaleDateString('pt-BR')
}
