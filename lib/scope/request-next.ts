// Next request anchor for the scope context (lib/scope/context.ts). The Next
// runs each route handler (and each RSC render) inside
// `workUnitAsyncStorage.run(requestStore, …)` — one store object per request.
// It is an `.external` module on purpose: app and runtime see the SAME
// AsyncLocalStorage instance. Internal path, no stability promise — isolated
// here so that a move breaks only THIS file at typecheck.
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external'

export function nextRequestAnchor(): object | undefined {
  const store = workUnitAsyncStorage.getStore()
  return store && store.type === 'request' ? store : undefined
}
