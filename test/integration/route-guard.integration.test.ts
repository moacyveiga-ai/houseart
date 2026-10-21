// Every private API handler answers 401 without a session (never 200, never 500).
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPublicRoute } from '@/lib/public-routes'
import './session'

const ROOT = join(__dirname, '..', '..')
function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return routes(p)
    return n === 'route.ts' ? [p] : []
  })
}
const files = routes(join(ROOT, 'app', 'api'))
const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const

describe('route guard without session', () => {
  it('finds routes', () => { expect(files.length).toBeGreaterThan(5) })
  for (const file of files) {
    const url = '/' + file.slice(join(ROOT, 'app').length + 1).replace(/\/route\.ts$/, '').replace(/\[([^\]]+)\]/g, '1')
    if (isPublicRoute(url)) continue
    it(`${url} refuses without session`, async () => {
      const mod = await import(file) as Record<string, (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>>
      for (const m of METHODS) {
        const handler = mod[m]
        if (!handler) continue
        const req = new Request(`http://test${url}`, { method: m, headers: { 'content-type': 'application/json' }, body: m === 'GET' ? undefined : '{}' })
        const res = await handler(req, { params: Promise.resolve({ id: '1', mediaId: '1', checkId: '1', kind: 'artwork-master' }) })
        expect([401, 403, 404], `${m} ${url} → ${res.status}`).toContain(res.status)
      }
    })
  }
})
