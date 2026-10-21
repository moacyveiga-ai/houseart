// A REAL session for integration tests: creates the Session row and hands the
// cookie through the `next/headers` mock of next-headers-mock.ts (setupFile).
import { createLocalSession } from '@/lib/auth'
import { requirePanel, type PanelSession } from '@/lib/auth/panel'
import { withScope } from '@/lib/scope/context'
import { cookieJar } from './next-headers-mock'

export async function signIn(userId: number, activeProfileKind: string | null = null): Promise<void> {
  cookieJar.value = await createLocalSession(userId, { activeProfileKind })
}

export function signOut(): void {
  cookieJar.value = null
}

/**
 * Runs `fn` as the user's panel session INSIDE the scope context (AsyncLocalStorage):
 * outside a Next request `enterScope` cannot reach the caller after an `await`,
 * so the test wraps the work exactly as `staffOnly`/`withJob` would.
 */
export async function asPanel<T>(userId: number, fn: (p: PanelSession) => Promise<T>, activeProfileKind: string | null = null): Promise<T> {
  await signIn(userId, activeProfileKind)
  const p = await requirePanel()
  return withScope(p.scope, 'test', () => fn(p))
}
