// Catraca das VARIÁVEIS DE AMBIENTE (QA geral, seção 5 — "131 lidas × 58
// documentadas; 3 nomes para a URL pública; runners do HouseValor caem em
// localhost:3007"):
//  · toda env que o código de runtime lê está no .env.example — ou é da
//    plataforma (Node, Next, Vercel), que ninguém configura;
//  · leitura por nome COMPUTADO (`env[ref]`) só nos arquivos declarados em
//    DINAMICAS, e a família de cada uma está documentada;
//  · toda env do .env.example é lida por alguém (runtime, scripts, testes,
//    configs) — documentação morta sai;
//  · a URL pública só se lê em lib/public-url.ts.
//
// Leitura pelo AST: `process.env.X`, `process.env['X']`, `env.X`/`env['X']`
// (o recorte de env que as funções puras recebem), `{ X } = process.env` e
// `env[CONSTANTE]` com a constante resolvida no próprio arquivo ou no módulo
// de onde ela é importada.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { FLAGS } from '../flags'
import { read, ROOT, sourceFiles } from './source-graph'

/** Injetadas pela plataforma — documentá-las seria pedir que alguém as configure. */
const PLATAFORMA = new Set([
  'NODE_ENV', 'NEXT_PHASE', 'NEXT_RUNTIME', 'TZ',
  'VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_GIT_COMMIT_SHA', 'VERCEL_PROJECT_PRODUCTION_URL',
])

/**
 * Arquivo → o que ele lê por nome COMPUTADO: os nomes exatos e as famílias
 * (prefixo terminado em `__`, o sufixo é a conta/parceiro/provedor), e
 * QUANTAS leituras computadas o arquivo tem — uma leitura nova no mesmo
 * arquivo muda a conta e pede que alguém diga o que ela lê. Nome exato conta
 * como lido (precisa de linha no .env.example); família precisa de ao menos
 * uma linha de exemplo com o prefixo.
 */
const DINAMICAS: Record<string, { nomes: string[]; leituras: number }> = {
  // the name comes from the FLAGS registry, which enters `lidas` whole (flags.test.ts checks the rest)
  'lib/flags.ts': { nomes: [], leituras: 1 },
}
const ehFamilia = (n: string) => n.endsWith('__')

/** Onde a URL pública pode ser lida (QA: eram 3 nomes lidos em 9 lugares). */
const URL_PUBLICA = new Set(['APP_URL', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_BASE_URL'])
const LEEM_URL_PUBLICA = new Set(['lib/public-url.ts'])

const RUNTIME = [...sourceFiles('app', 'lib', 'components'), 'middleware.ts', 'instrumentation.ts', 'next.config.ts']

const desembrulha = (e: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) ? desembrulha(e.expression) : e
const ehEnv = (e: ts.Expression): boolean => {
  const x = desembrulha(e)
  return (ts.isPropertyAccessExpression(x) && x.getText() === 'process.env') || (ts.isIdentifier(x) && x.text === 'env')
}

/** `const X = 'STRING'` e `const XS = ['A', 'B'] as const` do arquivo (exportadas ou não). */
function constantes(arquivo: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const sf = ts.createSourceFile(arquivo, read(arquivo), ts.ScriptTarget.Latest, true)
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue
      const v = desembrulha(d.initializer)
      if (ts.isStringLiteral(v)) out.set(d.name.text, [v.text])
      if (ts.isArrayLiteralExpression(v) && v.elements.length > 0 && v.elements.every(ts.isStringLiteral)) {
        out.set(d.name.text, v.elements.map(e => (e as ts.StringLiteral).text))
      }
    }
  }
  return out
}

/**
 * O identificador é o parâmetro de um callback passado a um método de uma
 * lista constante (`ENVS.every((nome) => env[nome])`)? Devolve o nome da lista.
 */
function listaDoCallback(id: ts.Identifier): string | undefined {
  for (let p: ts.Node | undefined = id.parent; p; p = p.parent) {
    if (!ts.isArrowFunction(p) && !ts.isFunctionExpression(p)) continue
    if (!p.parameters.some(par => ts.isIdentifier(par.name) && par.name.text === id.text)) continue
    const chamada = p.parent
    if (ts.isCallExpression(chamada) && ts.isPropertyAccessExpression(chamada.expression) && ts.isIdentifier(chamada.expression.expression)) {
      return chamada.expression.expression.text
    }
    return undefined
  }
  return undefined
}

/** O arquivo de onde vem um import (`@/x`, `./x`), ou null. */
function moduloDe(origem: string, especificador: string): string | null {
  const base = especificador.startsWith('@/') ? join(ROOT, especificador.slice(2)) : join(ROOT, dirname(origem), especificador)
  for (const ext of ['.ts', '.tsx', '/index.ts']) if (existsSync(base + ext)) return (base + ext).slice(ROOT.length + 1)
  return null
}

interface Leitura { arquivo: string; nome?: string; computada?: string }

function leituras(arquivo: string): Leitura[] {
  const sf = ts.createSourceFile(arquivo, read(arquivo), ts.ScriptTarget.Latest, true)
  const locais = constantes(arquivo)
  const importadas = new Map<string, string[]>()
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue
    const nomes = st.importClause?.namedBindings
    if (!nomes || !ts.isNamedImports(nomes)) continue
    const mod = moduloDe(arquivo, st.moduleSpecifier.text)
    if (!mod) continue
    const consts = constantes(mod)
    for (const el of nomes.elements) {
      const v = consts.get((el.propertyName ?? el.name).text)
      if (v) importadas.set(el.name.text, v)
    }
  }
  const out: Leitura[] = []
  const visitar = (n: ts.Node) => {
    if (ts.isPropertyAccessExpression(n) && ehEnv(n.expression) && /^[A-Z][A-Z0-9_]+$/.test(n.name.text)) {
      out.push({ arquivo, nome: n.name.text })
    }
    if (ts.isElementAccessExpression(n) && ehEnv(n.expression)) {
      const a = n.argumentExpression
      const lista = ts.isIdentifier(a) ? listaDoCallback(a) : undefined
      const nomes = ts.isStringLiteral(a)
        ? [a.text]
        : ts.isIdentifier(a)
          ? (locais.get(a.text) ?? importadas.get(a.text) ?? (lista ? locais.get(lista) : undefined))
          : undefined
      if (nomes) for (const nome of nomes) out.push({ arquivo, nome })
      else out.push({ arquivo, computada: n.getText() })
    }
    if (ts.isVariableDeclaration(n) && n.initializer && ehEnv(n.initializer) && ts.isObjectBindingPattern(n.name)) {
      for (const e of n.name.elements) out.push({ arquivo, nome: (e.propertyName ?? e.name).getText() })
    }
    ts.forEachChild(n, visitar)
  }
  visitar(sf)
  return out
}

const todas = RUNTIME.flatMap(leituras)
/**
 * Os literais do código de um arquivo como padrões de nome: string exata,
 * template com cada `${…}` virando `[A-Z0-9_]+` (só se começa por um prefixo
 * de nome, `X_…`), e regex ANCORADA (`^…$`, com as flags) — um normalizador
 * como `/[^A-Z0-9]/g` casaria qualquer nome.
 */
function formasDeNome(arquivo: string): RegExp[] {
  const sf = ts.createSourceFile(arquivo, read(arquivo), ts.ScriptTarget.Latest, true)
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const out: RegExp[] = []
  const visitar = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(new RegExp(`^${esc(n.text)}$`))
    if (ts.isTemplateExpression(n) && /^[A-Z][A-Z0-9]*_/.test(n.head.text)) {
      out.push(new RegExp(`^${esc(n.head.text)}${n.templateSpans.map(sp => `[A-Z0-9_]+${esc(sp.literal.text)}`).join('')}$`))
    }
    if (ts.isRegularExpressionLiteral(n)) {
      const t = n.text
      const fonte = t.slice(1, t.lastIndexOf('/'))
      if (fonte.startsWith('^') && fonte.endsWith('$')) out.push(new RegExp(fonte, t.slice(t.lastIndexOf('/') + 1).replace('g', '')))
    }
    ts.forEachChild(n, visitar)
  }
  visitar(sf)
  return out
}

const nomesDinamicos = Object.values(DINAMICAS).flatMap(d => d.nomes)
const lidas = new Set([
  ...todas.flatMap(l => (l.nome ? [l.nome] : [])),
  ...Object.keys(FLAGS),
  ...nomesDinamicos.filter(n => !ehFamilia(n)),
])
const familias = nomesDinamicos.filter(ehFamilia)
const exemplo = read('.env.example')
// `NOME=` ou `# NOME=`, com valor sem espaço — prosa como `# X=1 quando…` não documenta
const documentadas = [...exemplo.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=\S*\s*$/gm)].map(m => m[1]!)

describe('catraca das variáveis de ambiente', () => {
  it('o leitor acha as formas de ler env', () => {
    expect(leituras('lib/prisma.ts').map(l => l.nome)).toContain('DATABASE_URL')
    expect(lidas.has('FLAG_TENANT_SCOPE')).toBe(true) // pelo registro
    expect(leituras('lib/public-url.ts').map(l => l.nome)).toEqual(expect.arrayContaining(['APP_URL']))
  })

  it('toda env lida pelo runtime está no .env.example (ou é da plataforma)', () => {
    const doc = new Set(documentadas)
    const faltam = [...lidas].filter(n => !doc.has(n) && !PLATAFORMA.has(n)).sort()
    expect(
      faltam,
      'Env lida e não documentada: ponha `NOME=` (ou `# NOME=` se for opcional) no .env.example, ' +
      'com uma linha dizendo o que faz, o valor que liga e o que acontece sem ela.',
    ).toEqual([])
  })

  it('leitura por nome computado só nos arquivos declarados, contadas, com a família documentada', () => {
    const porArquivo = new Map<string, number>()
    for (const l of todas) if (l.computada) porArquivo.set(l.arquivo, (porArquivo.get(l.arquivo) ?? 0) + 1)
    const contagem = Object.fromEntries([...porArquivo].sort())
    const declarada = Object.fromEntries(Object.entries(DINAMICAS).map(([a, d]) => [a, d.leituras]).sort())
    expect(contagem, 'leitura computada nova: diga em DINAMICAS o que ela lê e ajuste a conta').toEqual(declarada)
    expect(familias.filter(f => !documentadas.some(n => n.startsWith(f)))).toEqual([])
    // o que a declaração diz que o arquivo lê precisa caber num literal do CÓDIGO dele
    // (string, template ou regex — comentário não conta); família testada com um sufixo
    const inventados = Object.entries(DINAMICAS).flatMap(([a, d]) => {
      const formas = formasDeNome(a)
      return d.nomes.filter(n => !formas.some(re => re.test(ehFamilia(n) ? `${n}CONTA1` : n))).map(n => `${a} ${n}`)
    })
    expect(inventados).toEqual([])
  })

  it('toda env do .env.example é lida por alguém — documentação morta sai', () => {
    // scripts, testes e configs leem env que o runtime não lê (ADMIN_*, DATABASE_URL_TEST,
    // DIRECT_URL) — conta só código, nunca comentário
    const semComentarios = ts.createPrinter({ removeComments: true })
    const outros = [
      ...sourceFiles('scripts', 'prisma', 'test', 'e2e'),
      ...['prisma.config.ts', 'playwright.config.ts', 'vitest.config.ts'].filter(f => existsSync(join(ROOT, f))),
    ]
      .map(f => semComentarios.printFile(ts.createSourceFile(f, read(f), ts.ScriptTarget.Latest, true)))
      .join('\n')
    const mortas = documentadas.filter(
      n => !lidas.has(n) && !familias.some(f => n.startsWith(f)) && !new RegExp(`\\b${n}\\b`).test(outros),
    )
    expect(mortas).toEqual([])
  })

  it('a URL pública só se lê em lib/public-url.ts (um nome, uma precedência)', () => {
    const fora = todas.filter(l => l.nome && URL_PUBLICA.has(l.nome) && !LEEM_URL_PUBLICA.has(l.arquivo)).map(l => `${l.arquivo} ${l.nome}`)
    expect(fora, 'use publicBaseUrl() of lib/public-url.ts').toEqual([])
  })
})
