// Login by code and signup by code, blind responses included.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { startLoginCode, startSignupCode, verifyAccessCode } from '@/lib/auth/access-code-server'
import { hashPassword } from '@/lib/auth'
import { sha256 } from '@/lib/auth/access-code-core'
import { truncateTables } from './db'
import './session'

async function codeOf(token: string): Promise<string> {
  // The test reads the hash and brute-forces the 6 digits: the code itself is never stored.
  const row = await prisma.accessCode.findUniqueOrThrow({ where: { tokenHash: sha256(token) } })
  for (let i = 0; i < 1_000_000; i++) { const c = String(i).padStart(6, '0'); if (sha256(c) === row.codeHash) return c }
  throw new Error('code not found')
}

beforeEach(async () => { await truncateTables(['Tenant', 'User', 'Artist', 'AccessCode', 'rate_limit_bucket']) })

describe('access codes', () => {
  it('signup creates user + tenant + member + artist after the code', async () => {
    const start = await startSignupCode('nova@artista.test', { name: 'Nova Artista', password: 'senha-forte-1', profileKind: 'ARTIST' })
    expect(start.ok).toBe(true)
    if (!start.ok) return
    const code = await codeOf(start.token)
    const r = await verifyAccessCode(start.token, code, {})
    expect(r.ok).toBe(true)
    const user = await prisma.user.findUnique({ where: { email: 'nova@artista.test' }, include: { member: { include: { artist: true } } } })
    expect(user?.member?.artist?.name).toBe('Nova Artista')
    expect(user?.tenantRole).toBe('ADMIN')
    expect(await verifyAccessCode(start.token, code, {})).toMatchObject({ ok: false })
  }, 60_000)

  it('login by code for an existing account; silent for unknown e-mail', async () => {
    await prisma.user.create({ data: { email: 'x@y.test', name: 'X', passwordHash: await hashPassword('senha-forte-1'), profile: 'member', active: true } })
    const known = await startLoginCode('x@y.test')
    const unknown = await startLoginCode('nobody@y.test')
    expect(known.ok && unknown.ok).toBe(true)
    if (!known.ok || !unknown.ok) return
    const rows = await prisma.accessCode.findMany({ orderBy: { id: 'asc' } })
    expect(rows.map((r) => r.purpose)).toEqual(['LOGIN', 'SILENT'])
    expect(await verifyAccessCode(known.token, await codeOf(known.token), {})).toMatchObject({ ok: true })
    expect(await verifyAccessCode(unknown.token, '000000', {})).toMatchObject({ ok: false })
  }, 60_000)
})
