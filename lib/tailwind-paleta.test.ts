// Catraca da paleta do Tailwind (auditoria geral, Lote 6, A-TEL-14). Classe
// como `bg-gray-50`, `text-emerald-700` ou `hover:bg-amber-100` é cor FIXA: não
// acompanha o tema escuro (o `thead` claro de /backoffice/valuation ficava sob
// o texto claro do tema) e fica fora do DS. No painel e no portal a cor vem de
// token `--hm-*` (`style={{ color: 'var(--ha-fg-muted)' }}`) ou de classe do
// DS (`hm-bo-table`, `hm-btn`).
//
// Lê o código como texto, como as outras catracas. A allowlist é CONGELADA por
// arquivo, com a contagem de quando a catraca nasceu (2026-10-15): SÓ DIMINUI.
// Arquivo que baixou a contagem quebra o teste até a linha aqui baixar junto
// (assim o ganho não se perde); arquivo novo, ou acima da contagem, quebra
// também. O `text-red-700` de erro desses arquivos deveria ser
// `--hm-status-error-ink` — outra entrega.
import { describe, expect, it } from 'vitest'
import { read, sourceFiles } from './architecture/source-graph'

/**
 * Utilidade de cor FIXA do Tailwind; pega também `hover:`/`sm:`/`dark:`: a escala
 * numérica da paleta, branco e preto (com opacidade, `text-black/50`) e cor
 * arbitrária (`bg-[#fff]`, `text-[rgb(…)]`, `hsl`, `oklch`) — as duas últimas
 * desde o Lote 7c. `transparent` e tamanho arbitrário (`text-[13px]`) ficam livres.
 */
const PALETA = new RegExp(
  String.raw`\b(?:[a-z-]+:)*(?:text|bg|border|ring|divide|outline|fill|stroke|placeholder|from|via|to|decoration|accent|caret)-` +
    String.raw`(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b` +
    String.raw`|(?:white|black)(?:\/\d{1,3})?\b` +
    String.raw`|\[(?:#|rgba?\(|hsla?\(|oklch\()[^\]]*\])`,
  'g',
)

/** Arquivo → quantas utilidades da paleta ele ainda tem (congelado; só diminui). */
const ALLOWLIST: Record<string, number> = {}

const contagens = (): Map<string, number> => {
  const out = new Map<string, number>()
  for (const file of sourceFiles('app', 'components').filter((f) => f.endsWith('.tsx'))) {
    const n = read(file).match(PALETA)?.length ?? 0
    if (n > 0) out.set(file, n)
  }
  return out
}

describe('catraca da paleta do Tailwind (A-TEL-14)', () => {
  it('a regex pega a utilidade pura e a com variante, e deixa o token do DS em paz', () => {
    const acha = (s: string) => s.match(PALETA)?.length ?? 0
    expect(acha('className="bg-gray-50 text-left"')).toBe(1)
    expect(acha('className="hover:bg-gray-50 sm:text-emerald-700"')).toBe(2)
    expect(acha('className="rounded border border-green-200 bg-green-50 text-green-800"')).toBe(3)
    expect(acha("style={{ color: 'var(--ha-fg-muted)' }}")).toBe(0)
    expect(acha('className="ha-table text-sm font-semibold"')).toBe(0)
    expect(acha('className="text-gray-950 bg-slate-25"')).toBe(1)
    // Lote 7c: branco e preto fixos (com opacidade) e cor arbitrária também são cor fixa
    expect(acha('className="bg-white text-black/50 hover:border-white"')).toBe(3)
    expect(acha('className="bg-[#fff] text-[rgb(0,0,0)] border-[hsl(0,0%,90%)] fill-[oklch(0.5_0.1_20)]"')).toBe(4)
    // tamanho arbitrário, transparente e token do DS seguem livres
    expect(acha('className="text-[13px] bg-transparent border-[var(--ha-border)] whitelist"')).toBe(0)
  })

  it('nenhum .tsx de app/ e components/ usa a paleta, fora da allowlist congelada', () => {
    const achados = contagens()
        const fora = [...achados]
      .filter(([file, n]) => n > (ALLOWLIST[file] ?? 0))
      .map(([file, n]) => `${file}: ${n} (permitido ${ALLOWLIST[file] ?? 0})`)
    expect(fora).toEqual([])
  })

  it('a allowlist só diminui: linha cuja contagem baixou (ou zerou) sai daqui', () => {
    const achados = contagens()
    const folgada = Object.entries(ALLOWLIST)
      .filter(([file, n]) => (achados.get(file) ?? 0) < n)
      .map(([file, n]) => `${file}: permitido ${n}, tem ${achados.get(file) ?? 0}`)
    expect(folgada).toEqual([])
  })
})
