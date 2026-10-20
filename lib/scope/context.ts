// Scope context — AsyncLocalStorage + request anchor. Ported from the
// Housebroker (lib/escopo/contexto.ts); the long rationale lives there and in
// HOUSEART_BUILD.md §A.2(8). Two channels:
//  1. AsyncLocalStorage (`withScope`/`totalScope`): whoever HAS the handler
//     wraps it (`staffOnly`, `withJob`); the context lasts while `fn` runs.
//  2. Request anchor (`enterScope`): `requirePanel()` is called in the BODY of
//     the handler after an `await`; `als.enterWith` there does not reach the
//     rest of the handler, so the guard stores the context in a WeakMap keyed
//     by the Next request store, and the extension reads by the same key.
// Precedence: an ALS store born in THIS request wins; else the anchor; else
// nothing. Without either (script, seed, test) the extension ALLOWS.
import { AsyncLocalStorage } from 'node:async_hooks'
import { TOTAL_SCOPE, type Scope } from './core'

export interface ScopeContext {
  scope: Scope
  /** who established the context (guard/wrapper/job name) — goes to the error and the log */
  origin: string
}

interface ScopeStore extends ScopeContext { anchor: object | undefined }

const als = new AsyncLocalStorage<ScopeStore>()
const perRequest = new WeakMap<object, ScopeContext>()
let requestAnchor: () => object | undefined = () => undefined

/** Installs the request-anchor lookup. Called once by lib/scope/index.ts with the Next version. */
export function setRequestAnchor(fn: () => object | undefined): void {
  requestAnchor = fn
}

/** Runs `fn` inside the scope; `await` the queries INSIDE `fn` (a PrismaPromise is lazy). */
export function withScope<T>(scope: Scope, origin: string, fn: () => Promise<T>): Promise<T> {
  return als.run({ scope, origin, anchor: requestAnchor() }, fn)
}

/** Explicit marker: `fn` sees the whole base on purpose (jobs, webhooks, staff-only routes). */
export function totalScope<T>(origin: string, fn: () => Promise<T>): Promise<T> {
  return withScope(TOTAL_SCOPE, origin, fn)
}

/** Declares the scope for the REST of the current request (what the guards call). */
export function enterScope(scope: Scope, origin: string): void {
  const ctx: ScopeContext = { scope, origin }
  const anchor = requestAnchor()
  if (anchor) perRequest.set(anchor, ctx)
  else als.enterWith({ ...ctx, anchor: undefined })
}

export function currentScopeContext(): ScopeContext | undefined {
  const anchor = requestAnchor()
  const store = als.getStore()
  if (store && store.anchor === anchor) return { scope: store.scope, origin: store.origin }
  if (anchor) return perRequest.get(anchor)
  return undefined
}

const marksPerRequest = new WeakMap<object, Set<string>>()

/** First time of this key IN the current request? `undefined` when there is no anchor. */
export function firstTimeInRequest(key: string): boolean | undefined {
  const anchor = requestAnchor()
  if (!anchor) return undefined
  let seen = marksPerRequest.get(anchor)
  if (!seen) { seen = new Set(); marksPerRequest.set(anchor, seen) }
  if (seen.has(key)) return false
  seen.add(key)
  return true
}
