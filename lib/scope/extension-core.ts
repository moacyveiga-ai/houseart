// Prisma scope extension — PURE CORE (no prisma, no env, testable). Ported
// from the Housebroker (lib/escopo/extension-core.ts). Given the model, the
// operation, the `where`, the current scope context and the environment: does
// the query proceed, get refused, or only logged?
//
// It checks whether the `where` MENTIONS an owner — not whether it filters
// correctly. A wrong `{ memberId: 999 }` passes; a forgotten `findMany({})`
// does not. That is the class of error the mechanism exists to catch.

import type { ScopeContext } from './context'

/** Models with an owner whose LISTS the extension watches (PascalCase as in the schema). */
export const HOT_MODELS: readonly string[] = [
  'Artwork', 'Offer', 'Deal', 'Mandate', 'Contact', 'Opportunity', 'Order',
  'Member', 'User', 'Tenant', 'Certificate', 'AppraisalRequest', 'OwnershipTransfer',
]

/** Operations that return (or hit) MORE THAN ONE row without an id. */
export const LIST_OPERATIONS: readonly string[] = [
  'findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany',
]

/** Keys that, at any depth of the `where`, count as "mentions the owner". */
export const OWNER_KEYS: readonly string[] = [
  'tenantId', 'memberId', 'id', 'userId', 'ownerUserId', 'buyerUserId', 'fromUserId', 'holderUserId',
  'offerId', 'dealId', 'artworkId', 'certificateId',
]

const HOT_MODELS_SET: ReadonlySet<string> = new Set(HOT_MODELS)
const LIST_OPERATIONS_SET: ReadonlySet<string> = new Set(LIST_OPERATIONS)
const OWNER_KEYS_SET: ReadonlySet<string> = new Set(OWNER_KEYS)

export type Decision = 'allow' | 'throw' | 'log'

/** Cheap filter: hot model AND list operation. */
export function watchedQuery(model: string, operation: string): boolean {
  return HOT_MODELS_SET.has(model) && LIST_OPERATIONS_SET.has(operation)
}

export function whereMentionsOwner(where: unknown, keys: ReadonlySet<string> | readonly string[] = OWNER_KEYS_SET): boolean {
  return mentionsAny(where, keys instanceof Set ? keys : new Set(keys))
}

function mentionsAny(where: unknown, keys: ReadonlySet<string>): boolean {
  if (where === null || typeof where !== 'object') return false
  if (Array.isArray(where)) return where.some((item) => mentionsAny(item, keys))
  for (const [key, value] of Object.entries(where as Record<string, unknown>)) {
    if (keys.has(key)) return true
    if (value !== null && typeof value === 'object' && mentionsAny(value, keys)) return true
  }
  return false
}

export interface QueryToDecide {
  model: string
  operation: string
  where: unknown
  context: ScopeContext | undefined
  environment: string | undefined
}

export function decideQuery(q: QueryToDecide): Decision {
  if (!watchedQuery(q.model, q.operation)) return 'allow'
  if (!q.context) return 'allow'
  if (q.context.scope.kind === 'total') return 'allow'
  if (whereMentionsOwner(q.where)) return 'allow'
  return q.environment === 'test' || q.environment === 'development' ? 'throw' : 'log'
}

/** Key dedupe with cap and TTL — the production log fallback when there is no request anchor. */
export class KeyDedupe {
  private readonly seen = new Map<string, number>()
  constructor(private readonly max: number, private readonly ttlMs: number) {}
  firstTime(key: string, now: number): boolean {
    const at = this.seen.get(key)
    if (at !== undefined && now - at < this.ttlMs) return false
    this.seen.delete(key)
    this.seen.set(key, now)
    if (this.seen.size > this.max) {
      const oldest = this.seen.keys().next().value
      if (oldest !== undefined) this.seen.delete(oldest)
    }
    return true
  }
  get size(): number { return this.seen.size }
}

/** Thrown in dev/test when a hot list runs unscoped inside a scoped context. */
export class ScopeNotApplied extends Error {
  readonly model: string
  readonly operation: string
  readonly origin: string
  constructor(model: string, operation: string, origin: string) {
    super(
      `[scope] ${model}.${operation} without an owner filter inside a scoped context (origin: ${origin}). ` +
      'Spread a lib/scope constructor in the `where` (memberFilter, tenantFilter…) or, if the query is of the whole base on purpose, run it in totalScope().',
    )
    this.name = 'ScopeNotApplied'
    this.model = model
    this.operation = operation
    this.origin = origin
  }
}
