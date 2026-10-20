// Data scope — the door. Re-exports the pure core and the context, and wires
// the context to the Next request (channel 2 of lib/scope/context.ts). The
// session guards (`requirePanel`, `panelSession`) live in lib/scope/session.ts
// (Phase 1, on top of lib/auth) — this module stays free of lib/auth so that
// pure modules can import the builders.
import { flagOn } from '@/lib/flags'
import { setRequestAnchor } from './context'
import { nextRequestAnchor } from './request-next'

export * from './core'
export { withScope, totalScope, enterScope, currentScopeContext, type ScopeContext } from './context'

setRequestAnchor(nextRequestAnchor)

/** Tenant level (ADR-010) on? Born ON (`FLAG_TENANT_SCOPE` defaultOn); `0` turns it off. */
export function tenantLevelOn(): boolean {
  return flagOn('FLAG_TENANT_SCOPE')
}
