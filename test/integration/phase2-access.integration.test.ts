// Handoff Fase 2: phone by SMS code, password reset by link, social login (MOCK provider), preferences.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword, createLocalSession, getSessionByToken } from '@/lib/auth'
import { completePasswordReset, resendEmailChange, resendPhoneCode, startEmailChange, startPasswordReset, startPhoneCode, verifyAccessCode, verifyEmailChange, verifyPhoneCode } from '@/lib/auth/access-code-server'
import { sha256 } from '@/lib/auth/access-code-core'
import { completeOAuth } from '@/lib/auth/oauth/server'
import { savePreferences } from '@/lib/accounts/preferences-server'
import { truncateTables } from './db'
import './session'

async function codeOf(token: string): Promise<string> {
  const row = await prisma.accessCode.findUniqueOrThrow({ where: { tokenHash: sha256(token) } })
  for (let i = 0; i < 1_000_000; i++) { const c = String(i).padStart(6, '0'); if (sha256(c) === row.codeHash) return c }
  throw new Error('code not found')
}

const state = (over: Partial<Parameters<typeof completeOAuth>[1]> = {}) => ({ nonce: 'n', provider: 'MOCK' as const, purpose: 'signup' as const, profileKind: 'COLLECTOR', plan: null, next: null, verifier: 'v', issuedAt: Date.now(), ...over })

beforeEach(async () => { await truncateTables(['Tenant', 'User', 'Artist', 'AccessCode', 'UserIdentity', 'Session', 'rate_limit_bucket']) })

describe('phone by SMS', () => {
  it('verifies the phone of the logged user; a phone verified elsewhere is silent', async () => {
    const a = await prisma.user.create({ data: { email: 'a@t.test', name: 'A', passwordHash: await hashPassword('senha-forte-1'), profile: 'collector', active: true } })
    const b = await prisma.user.create({ data: { email: 'b@t.test', name: 'B', passwordHash: await hashPassword('senha-forte-1'), profile: 'collector', active: true } })
    expect(await startPhoneCode(a.id, '71 9999')).toMatchObject({ ok: false })
    const s = await startPhoneCode(a.id, '(71) 99999-0001')
    expect(s).toMatchObject({ ok: true, phoneMask: '(71) 99999-0001' })
    if (!s.ok) return
    expect(await verifyPhoneCode(b.id, s.token, await codeOf(s.token))).toMatchObject({ ok: false })
    expect(await verifyPhoneCode(a.id, s.token, '000000')).toMatchObject({ ok: false })
    expect(await verifyPhoneCode(a.id, s.token, await codeOf(s.token))).toMatchObject({ ok: true })
    const ua = await prisma.user.findUniqueOrThrow({ where: { id: a.id } })
    expect(ua.phone).toBe('+5571999990001'); expect(ua.phoneVerifiedAt).not.toBeNull()
    // B tries the same phone: blind ok, SILENT row, never verifies
    const s2 = await startPhoneCode(b.id, '71999990001')
    expect(s2.ok).toBe(true)
    if (!s2.ok) return
    const row = await prisma.accessCode.findUniqueOrThrow({ where: { tokenHash: sha256(s2.token) } })
    expect(row.purpose).toBe('SILENT')
    expect(await verifyPhoneCode(b.id, s2.token, await codeOf(s2.token))).toMatchObject({ ok: false })
    expect(await resendPhoneCode(b.id, s2.token)).toMatchObject({ ok: true })
  }, 60_000)
})

describe('e-mail change by code', () => {
  it('the code goes to the new address; only the owner of the request confirms; a taken address is silent', async () => {
    const a = await prisma.user.create({ data: { email: 'a@t.test', name: 'A', passwordHash: await hashPassword('senha-forte-1'), profile: 'collector', active: true } })
    const b = await prisma.user.create({ data: { email: 'b@t.test', name: 'B', passwordHash: await hashPassword('senha-forte-1'), profile: 'collector', active: true } })
    expect(await startEmailChange(a.id, 'nao-e-email', 'senha-forte-1')).toMatchObject({ ok: false })
    expect(await startEmailChange(a.id, 'A@t.test', 'senha-forte-1')).toMatchObject({ ok: false })
    // a session alone is not enough: the current password is asked
    expect(await startEmailChange(a.id, 'nova@t.test', 'errada')).toMatchObject({ ok: false, error: 'Senha atual incorreta.' })
    const keep = await prisma.session.create({ data: { userId: a.id, token: 'h1:keep', expiresAt: new Date(Date.now() + 86_400_000) } })
    await prisma.session.create({ data: { userId: a.id, token: 'h1:other', expiresAt: new Date(Date.now() + 86_400_000) } })
    const reset = await startPasswordReset('a@t.test')
    expect(reset.ok).toBe(true)
    const s = await startEmailChange(a.id, 'Nova@T.test', 'senha-forte-1')
    expect(s.ok).toBe(true)
    if (!s.ok) return
    // the public code door never takes it
    expect(await verifyAccessCode(s.token, await codeOf(s.token), {})).toMatchObject({ ok: false })
    expect(await verifyEmailChange(b.id, s.token, await codeOf(s.token))).toMatchObject({ ok: false })
    expect(await verifyEmailChange(a.id, s.token, '000000')).toMatchObject({ ok: false })
    expect(await verifyEmailChange(a.id, s.token, await codeOf(s.token), { keepSessionId: keep.id })).toMatchObject({ ok: true, email: 'nova@t.test' })
    // the other sessions and the open reset link die; this session stays
    expect((await prisma.session.findMany({ where: { userId: a.id } })).map((x) => x.id)).toEqual([keep.id])
    expect(await prisma.accessCode.count({ where: { userId: a.id, purpose: 'RESET', consumedAt: null } })).toBe(0)
    const ua = await prisma.user.findUniqueOrThrow({ where: { id: a.id } })
    expect(ua.email).toBe('nova@t.test'); expect(ua.emailVerifiedAt).not.toBeNull()
    expect(await verifyEmailChange(a.id, s.token, await codeOf(s.token))).toMatchObject({ ok: false })
    // B asks for A's new address: blind ok, SILENT row, never verifies
    const s2 = await startEmailChange(b.id, 'nova@t.test', 'senha-forte-1')
    expect(s2.ok).toBe(true)
    if (!s2.ok) return
    expect((await prisma.accessCode.findUniqueOrThrow({ where: { tokenHash: sha256(s2.token) } })).purpose).toBe('SILENT')
    expect(await verifyEmailChange(b.id, s2.token, await codeOf(s2.token))).toMatchObject({ ok: false })
    expect(await resendEmailChange(b.id, s2.token)).toMatchObject({ ok: true })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: b.id } })).email).toBe('b@t.test')
  }, 60_000)
})

describe('password reset', () => {
  it('known e-mail gets a RESET row; the link sets the password once and closes sessions', async () => {
    const u = await prisma.user.create({ data: { email: 'r@t.test', name: 'R', passwordHash: await hashPassword('senha-antiga-1'), profile: 'member', active: true } })
    const cookie = await createLocalSession(u.id)
    expect(await startPasswordReset('ninguem@t.test')).toEqual({ ok: true })
    expect(await startPasswordReset('r@t.test')).toEqual({ ok: true })
    const rows = await prisma.accessCode.findMany({ orderBy: { id: 'asc' } })
    expect(rows.map((r) => r.purpose)).toEqual(['SILENT', 'RESET'])
    // The token travels only in the e-mail: the test plants a known one on the RESET row.
    await prisma.accessCode.update({ where: { id: rows[1].id }, data: { tokenHash: sha256('known-token') } })
    await prisma.accessCode.update({ where: { id: rows[0].id }, data: { tokenHash: sha256('silent-token') } })
    expect(await completePasswordReset('silent-token', 'senha-nova-22')).toMatchObject({ ok: false })
    expect(await completePasswordReset('known-token', 'senha-nova-22')).toMatchObject({ ok: true, email: 'r@t.test' })
    expect(await completePasswordReset('known-token', 'senha-nova-33')).toMatchObject({ ok: false })
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(await verifyPassword('senha-nova-22', after.passwordHash!)).toBe(true)
    expect(await getSessionByToken(cookie)).toBeNull()
  }, 60_000)
})

describe('social login (MOCK identity)', () => {
  const id = (email: string) => ({ provider: 'MOCK' as const, providerUserId: `mock:${email}`, email, emailVerified: true, name: 'Soc Ial' })
  it('signup with a profile creates the account and the identity; a second visit logs in', async () => {
    const first = await completeOAuth(id('soc@t.test'), state(), {})
    expect(first).toMatchObject({ kind: 'session', created: true })
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'soc@t.test' }, include: { identities: true, profiles: true } })
    expect(u.passwordHash).toBeNull(); expect(u.emailVerifiedAt).not.toBeNull(); expect(u.identities).toHaveLength(1); expect(u.profiles[0].kind).toBe('COLLECTOR')
    const again = await completeOAuth(id('soc@t.test'), state({ purpose: 'login' }), {})
    expect(again).toMatchObject({ kind: 'session', created: false })
    expect(await prisma.userIdentity.count()).toBe(1)
  }, 60_000)
  it('login of an unknown e-mail does not create; same verified e-mail links to the existing account', async () => {
    expect(await completeOAuth(id('new@t.test'), state({ purpose: 'login' }), {})).toEqual({ kind: 'no-account' })
    expect(await prisma.user.count()).toBe(0)
    const u = await prisma.user.create({ data: { email: 'old@t.test', name: 'Old', passwordHash: await hashPassword('senha-forte-1'), profile: 'member', active: true } })
    expect(await completeOAuth(id('old@t.test'), state({ purpose: 'login' }), {})).toMatchObject({ kind: 'session', created: false })
    expect(await prisma.userIdentity.findFirst({ where: { userId: u.id } })).not.toBeNull()
    expect(await completeOAuth({ ...id('old@t.test'), providerUserId: 'mock:other', emailVerified: false }, state({ purpose: 'login' }), {})).toEqual({ kind: 'no-account' })
    expect(await completeOAuth({ ...id('x@t.test'), email: null }, state(), {})).toEqual({ kind: 'no-email' })
  }, 60_000)
})

describe('preferences', () => {
  it('stores allowlisted preferences, the newsletter and the terms once', async () => {
    const u = await prisma.user.create({ data: { email: 'p@t.test', name: 'P', profile: 'collector', active: true } })
    const r = await savePreferences(u.id, { uses: ['COLLECT', 'NOPE'], interests: ['PAINTING'], city: 'Salvador', marketingOptIn: true, termsAccepted: true })
    expect(r.preferences).toEqual({ uses: ['COLLECT'], interests: ['PAINTING'], city: 'Salvador' })
    expect(r.marketingOptIn).toBe(true); expect(r.termsAcceptedAt).not.toBeNull()
    const r2 = await savePreferences(u.id, { city: 'Recife', termsAccepted: true })
    expect(r2.preferences.city).toBe('Recife'); expect(r2.preferences.uses).toEqual(['COLLECT']); expect(r2.termsAcceptedAt).toBe(r.termsAcceptedAt)
  }, 60_000)
})
