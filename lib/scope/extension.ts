// Prisma scope extension — the link with the client. Enters lib/prisma.ts
// (`client.$extends(scopeExtension)`) and sees EVERY query of EVERY model.
// The decision is the pure core (extension-core.ts); here only the current
// context and the environment are read and the verdict applied:
//   allow → proceeds; throw → `ScopeNotApplied` (dev/test);
//   log → `console.error('[scope] unscoped query', …)` and proceeds (production).
import { Prisma } from '@/app/generated/prisma/client'
import { currentScopeContext, firstTimeInRequest } from './context'
import { decideQuery, KeyDedupe, ScopeNotApplied, watchedQuery } from './extension-core'

const dedupeWithoutRequest = new KeyDedupe(256, 60_000)

function shouldLog(model: string, operation: string): boolean {
  const key = `${model}.${operation}`
  return firstTimeInRequest(key) ?? dedupeWithoutRequest.firstTime(key, Date.now())
}

export const scopeExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!watchedQuery(model, operation)) return query(args)
          const context = currentScopeContext()
          const where = (args as { where?: unknown } | undefined)?.where
          const decision = decideQuery({ model, operation, where, context, environment: process.env.NODE_ENV })
          if (decision === 'throw') throw new ScopeNotApplied(model, operation, context?.origin ?? '?')
          if (decision === 'log' && shouldLog(model, operation)) {
            console.error('[scope] unscoped query', { model, operation, origin: context?.origin, scope: context?.scope.kind })
          }
          return query(args)
        },
      },
    },
  }),
)
