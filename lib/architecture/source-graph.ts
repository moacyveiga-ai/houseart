// Leitor do grafo de imports do repositório — só para as catracas de
// arquitetura (lib/architecture/*.test.ts; QA geral, seção 6). Lê o código
// pela AST do TypeScript (não por regex: a regex engolia o import que vinha
// depois de um `export type` sem ponto e vírgula — revisão de 2026-10-03).
// Nada aqui roda no app.
//
// O que conta como import: `import … from 'x'`, `export … from 'x'`,
// `import 'x'` e `import('x')` dinâmico. `import type`/`export type`, imports
// só de tipos (`import { type A, type B }`) e `typeof import('x')` não contam
// — não existem em runtime. O import dinâmico CONTA: ele adia o carregamento,
// mas o acoplamento entre os módulos é o mesmo (senão trocar `import` por
// `await import` "quebraria" um ciclo sem quebrar nada).

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

/** A raiz do repositório, pela posição DESTE arquivo (não pelo cwd de quem roda). */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const IGNORED_DIRS = new Set(['node_modules', 'generated', '.next', '.git', '.vercel', '.turbo'])
const TEST_FILE = /\.(test|spec|smoke)\.tsx?$/

/** Arquivos .ts/.tsx de código (sem testes, sem .d.ts, sem o client gerado do Prisma). */
export function sourceFiles(...dirs: string[]): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(join(ROOT, d))) {
      // `.well-known` é rota do Next: só os diretórios da lista ficam de fora
      if (IGNORED_DIRS.has(name) || name === '.DS_Store') continue
      const rel = join(d, name)
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel)
      else if (/\.tsx?$/.test(name) && !TEST_FILE.test(name) && !name.endsWith('.d.ts')) out.push(rel)
    }
  }
  for (const d of dirs) walk(d)
  return out.sort()
}

/** Import só de tipos: `import type …` ou `import { type A, type B }` (sem default nem namespace). */
function typeOnlyImport(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause
  if (!clause) return false // `import 'x'` — efeito colateral, conta
  if (clause.isTypeOnly) return true
  if (clause.name) return false
  const bindings = clause.namedBindings
  if (!bindings || ts.isNamespaceImport(bindings)) return false
  return bindings.elements.length > 0 && bindings.elements.every((e) => e.isTypeOnly)
}

function typeOnlyExport(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly) return true
  const clause = node.exportClause
  return clause != null && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((e) => e.isTypeOnly)
}

/** Os especificadores importados em runtime por um arquivo. */
export function runtimeImports(source: string, fileName = 'x.tsx'): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!typeOnlyImport(node)) out.push(node.moduleSpecifier.text)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!typeOnlyExport(node)) out.push(node.moduleSpecifier.text)
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0]
      if (arg && ts.isStringLiteralLike(arg)) out.push(arg.text)
    }
    // `typeof import('x')` é ImportTypeNode, não CallExpression: não entra.
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

/** Resolve `@/x` e `./x` para o arquivo do repositório; pacote externo → null. */
export function resolveImport(fromFile: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = spec.slice(2)
  else if (spec.startsWith('.')) base = join(dirname(fromFile), spec)
  else return null
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx'), base]) {
    try {
      if (statSync(join(ROOT, c)).isFile()) return relative(ROOT, join(ROOT, c))
    } catch {
      // não existe nessa forma — tenta a próxima
    }
  }
  return null
}

export function read(file: string): string {
  return readFileSync(join(ROOT, file), 'utf8')
}

/** `runtimeImports` de um arquivo do repositório. */
export function importsOf(file: string): string[] {
  return runtimeImports(read(file), file)
}

/** O módulo de um arquivo de lib/: `lib/ofertas/server.ts` → `ofertas`; `lib/prisma.ts` → `prisma`. */
export function moduleOf(file: string): string | null {
  const m = file.match(/^lib\/([^/]+?)(?:\.tsx?)?(?:\/|$)/)
  return m ? m[1] : null
}

/** Arestas módulo → módulo dentro de lib/ (sem laço do módulo consigo mesmo). */
export function moduleEdges(): Map<string, Set<string>> {
  const edges = new Map<string, Set<string>>()
  for (const f of sourceFiles('lib')) {
    const from = moduleOf(f)
    if (!from) continue
    for (const spec of importsOf(f)) {
      const target = resolveImport(f, spec)
      const to = target ? moduleOf(target) : null
      if (!to || to === from) continue
      if (!edges.has(from)) edges.set(from, new Set())
      edges.get(from)!.add(to)
    }
  }
  return edges
}

/** Componentes fortemente conexos (Tarjan): módulo → id do componente. */
export function stronglyConnected(edges: Map<string, Set<string>>): Map<string, number> {
  const nodes = new Set<string>([...edges.keys(), ...[...edges.values()].flatMap((s) => [...s])])
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const comp = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  let next = 0
  let compId = 0
  const visit = (v: string) => {
    index.set(v, next)
    low.set(v, next)
    next++
    stack.push(v)
    onStack.add(v)
    for (const w of edges.get(v) ?? []) {
      if (!index.has(w)) {
        visit(w)
        low.set(v, Math.min(low.get(v)!, low.get(w)!))
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!))
      }
    }
    if (low.get(v) === index.get(v)) {
      let w: string
      do {
        w = stack.pop()!
        onStack.delete(w)
        comp.set(w, compId)
      } while (w !== v)
      compId++
    }
  }
  for (const v of [...nodes].sort()) if (!index.has(v)) visit(v)
  return comp
}
