// ════════════════════════════════════════════════════════════════════════════
//  Formatação numérica padrão ABNT (pt-BR).
//  Moeda: R$ 1.234,56  ·  Número: 1.234,56  ·  separador milhar "." decimal ","
//  Util único do sistema — substitui os helpers `brl` duplicados.
// ════════════════════════════════════════════════════════════════════════════

/** Moeda BRL padrão ABNT: R$ 1.234,56 (sempre 2 casas). */
export function formatBRL(v: number | null | undefined, opts?: { casas?: number; vazio?: string }): string {
  if (v == null || Number.isNaN(v)) return opts?.vazio ?? 'R$ 0,00'
  const casas = opts?.casas ?? 2
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

/** Número ABNT: 1.234,56 (sem símbolo de moeda). */
export function formatNumero(v: number | null | undefined, casas = 2): string {
  if (v == null || Number.isNaN(v)) return casas > 0 ? `0,${'0'.repeat(casas)}` : '0'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

/** Inteiro com separador de milhar: 1.234. */
export function formatInteiro(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '0'
  return Math.round(v).toLocaleString('pt-BR')
}

/** Percentual ABNT: 12,5%. */
export function formatPercent(v: number | null | undefined, casas = 1): string {
  if (v == null || Number.isNaN(v)) return `0${casas > 0 ? `,${'0'.repeat(casas)}` : ''}%`
  return `${formatNumero(v, casas)}%`
}

/**
 * Converte string formatada (pt-BR ou livre) para número.
 * Aceita "R$ 1.234,56", "1.234,56", "1234.56", "1234,56".
 */
export function parseNumero(s: string | number | null | undefined): number {
  if (typeof s === 'number') return s
  if (!s) return 0
  let t = String(s).replace(/[^\d.,-]/g, '').trim()
  if (!t) return 0
  const temVirgula = t.includes(',')
  const temPonto = t.includes('.')
  if (temVirgula && temPonto) {
    // "1.234,56" → ponto é milhar, vírgula é decimal
    t = t.replace(/\./g, '').replace(',', '.')
  } else if (temVirgula) {
    // "1234,56" → vírgula é decimal
    t = t.replace(',', '.')
  }
  // só ponto → já está no formato JS (ou é milhar de inteiro; assume decimal)
  const n = parseFloat(t)
  return Number.isNaN(n) ? 0 : n
}

/** Alias semântico para entrada de moeda. */
export const parseBRL = parseNumero

/**
 * Máscara progressiva de moeda enquanto digita: trata os dígitos como centavos.
 * "123456" → "1.234,56" · "5" → "0,05". Retorna { mascara, valor }.
 */
export function mascaraMoedaDigitando(raw: string): { mascara: string; valor: number } {
  const digitos = (raw || '').replace(/\D/g, '')
  if (!digitos) return { mascara: '', valor: 0 }
  const valor = parseInt(digitos, 10) / 100
  return { mascara: formatNumero(valor, 2), valor }
}
