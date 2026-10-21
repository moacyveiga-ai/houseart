// setupFile of the integration project: `next/headers` outside a request
// reads the cookie that test/integration/session.ts set. Declared here (a
// setupFile) so the mock is registered before any test imports lib/auth.
import { vi } from 'vitest'

export const cookieJar: { value: string | null } = { value: null }

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'houseart_session' && cookieJar.value ? { name, value: cookieJar.value } : undefined) }),
  headers: async () => new Headers(),
}))
