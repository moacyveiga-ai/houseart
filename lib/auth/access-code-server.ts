// One-time codes by e-mail: LOGIN of an existing account or SIGNUP of a new
// one. Blind response: the start always says "we sent a code"; an unknown
// e-mail on LOGIN (or a known one on SIGNUP) writes a SILENT row with a
// random code nobody receives, so timing and shape do not reveal accounts.
import { prisma } from '@/lib/prisma'
import { decryptText, encryptText } from '@/lib/crypto/cipher'
import { sendEmail } from '@/lib/email/send'
import { afterResponse } from '@/lib/after'
import { hashPassword, normalizeEmail, openSession, type LoginResult } from './index'
import { CODE_BLOCK_MS, CODE_MAX_ATTEMPTS, CODE_MAX_RESENDS, CODE_TTL_MS, newCode, newToken, sha256, verdictMessage, verifyCode, type CodePurpose } from './access-code-core'
import { PROFILE_KINDS, type ProfileKindKey } from '@/lib/profiles/core'
import { createMemberAccount } from '@/lib/accounts/signup-server'

export interface SignupPayload {
  name: string
  password: string
  profileKind: ProfileKindKey
  cpf?: string | null
}

async function issue(purpose: CodePurpose, email: string, payload: SignupPayload | null): Promise<{ token: string; code: string }> {
  const code = newCode()
  const token = newToken()
  await prisma.accessCode.create({
    data: {
      tokenHash: sha256(token),
      purpose,
      email,
      codeHash: sha256(purpose === 'SILENT' ? newCode() : code),
      payloadEnc: payload ? encryptText(JSON.stringify(payload)) : null,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  })
  return { token, code }
}

function mailCode(email: string, code: string, purpose: 'LOGIN' | 'SIGNUP') {
  afterResponse('auth: code e-mail', () => sendEmail({
    to: email,
    subject: purpose === 'SIGNUP' ? 'Seu código para criar a conta na HouseArt' : 'Seu código de acesso à HouseArt',
    text: `Seu código é ${code}. Ele vale por 15 minutos. Se você não pediu este código, ignore esta mensagem.`,
    redactedPreview: `código ${purpose}`,
  }))
}

/** Start a LOGIN by code. Always returns a token (blind). */
export async function startLoginCode(rawEmail: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const email = normalizeEmail(rawEmail)
  if (!email) return { ok: false, error: 'Informe um e-mail válido.' }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, active: true, profile: true } })
  if (!user || !user.active) {
    const { token } = await issue('SILENT', email, null)
    return { ok: true, token }
  }
  const { token, code } = await issue('LOGIN', email, null)
  mailCode(email, code, 'LOGIN')
  return { ok: true, token }
}

/** Start a SIGNUP: the account is only created after the code proves the e-mail. */
export async function startSignupCode(rawEmail: string, payload: SignupPayload): Promise<{ ok: true; token: string; echo?: string } | { ok: false; error: string }> {
  const email = normalizeEmail(rawEmail)
  if (!email) return { ok: false, error: 'Informe um e-mail válido.' }
  if (!(PROFILE_KINDS as readonly string[]).includes(payload.profileKind) || payload.profileKind === 'STAFF' || payload.profileKind === 'APPRAISER') {
    return { ok: false, error: 'Perfil inválido para cadastro.' }
  }
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (exists) {
    const { token } = await issue('SILENT', email, null)
    return { ok: true, token }
  }
  const safe: SignupPayload = { ...payload, password: await hashPassword(payload.password) }
  const { token, code } = await issue('SIGNUP', email, safe)
  mailCode(email, code, 'SIGNUP')
  return { ok: true, token, ...(codeEchoAllowed() ? { echo: code } : {}) }
}

export async function resendCode(token: string): Promise<{ ok: boolean }> {
  const row = await prisma.accessCode.findUnique({ where: { tokenHash: sha256(token) } })
  if (!row || row.consumedAt || row.resends >= CODE_MAX_RESENDS || row.expiresAt < new Date()) return { ok: true }
  const code = newCode()
  await prisma.accessCode.update({ where: { id: row.id }, data: { codeHash: sha256(row.purpose === 'SILENT' ? newCode() : code), resends: { increment: 1 }, attempts: 0, expiresAt: new Date(Date.now() + CODE_TTL_MS) } })
  if (row.purpose !== 'SILENT') mailCode(row.email, code, row.purpose as 'LOGIN' | 'SIGNUP')
  return { ok: true }
}

/** Verify the code; on success opens the session (LOGIN) or creates the account and opens it (SIGNUP). */
export async function verifyAccessCode(token: string, code: string, ctx: { ip?: string; userAgent?: string }): Promise<LoginResult> {
  const row = await prisma.accessCode.findUnique({ where: { tokenHash: sha256(token) } })
  if (!row) return { ok: false, error: 'Código inválido ou expirado. Peça um novo código.' }
  // Atomic attempt count BEFORE deciding (no window for parallel guesses).
  const bumped = await prisma.accessCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } })
  const verdict = verifyCode(bumped, code, new Date())
  if (!verdict.ok) {
    if (verdict.block) await prisma.accessCode.update({ where: { id: row.id }, data: { blockedUntil: new Date(Date.now() + CODE_BLOCK_MS) } })
    return { ok: false, error: verdictMessage(verdict) }
  }
  if (bumped.attempts > CODE_MAX_ATTEMPTS) return { ok: false, error: 'Código inválido ou expirado. Peça um novo código.' }
  const consumed = await prisma.accessCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } })
  if (consumed.count === 0) return { ok: false, error: 'Código já utilizado.' }

  if (row.purpose === 'LOGIN') {
    const user = await prisma.user.findUnique({ where: { email: row.email } })
    if (!user || !user.active) return { ok: false, error: 'Conta indisponível.' }
    return openSession(user, ctx)
  }
  // SIGNUP
  const payload = JSON.parse(decryptText(row.payloadEnc ?? '')) as SignupPayload
  const user = await createMemberAccount({ email: row.email, name: payload.name, passwordHash: payload.password, profileKind: payload.profileKind, cpf: payload.cpf ?? null, emailVerified: true })
  return openSession(user, ctx)
}

// ── Phase 2 (handoff): phone by SMS, password reset by link, e-mail verified ──
import { sendSms } from '@/lib/sms/send'
import { maskPhone, normalizeBrMobile } from '@/lib/sms/core'
import { RESET_TTL_MS, codeEchoAllowed } from './access-code-core'
import { publicBaseUrl } from '@/lib/public-url'
import { destroyAllSessions } from './index'

/** Start the SMS code for the LOGGED user's phone (purpose PHONE). Blind on a phone already taken by another account. */
export async function startPhoneCode(userId: number, rawPhone: string): Promise<{ ok: true; token: string; phoneMask: string; echo?: string } | { ok: false; error: string }> {
  const phone = normalizeBrMobile(rawPhone)
  if (!phone) return { ok: false, error: 'Informe um celular válido com DDD.' }
  const code = newCode()
  const token = newToken()
  const taken = await prisma.user.findFirst({ where: { phone, phoneVerifiedAt: { not: null }, id: { not: userId } }, select: { id: true } })
  await prisma.accessCode.create({ data: { tokenHash: sha256(token), purpose: taken ? 'SILENT' : 'PHONE', channel: 'SMS', email: '', phone, userId, codeHash: sha256(taken ? newCode() : code), expiresAt: new Date(Date.now() + CODE_TTL_MS) } })
  if (!taken) afterResponse('auth: sms code', () => sendSms(phone, `HouseArt: seu código é ${code}. Vale por 15 minutos.`, 'código PHONE'))
  return { ok: true, token, phoneMask: maskPhone(phone), ...(codeEchoAllowed() && !taken ? { echo: code } : {}) }
}

export async function verifyPhoneCode(userId: number, token: string, code: string): Promise<{ ok: true; phoneMask: string } | { ok: false; error: string }> {
  const row = await prisma.accessCode.findUnique({ where: { tokenHash: sha256(token) } })
  if (!row || row.userId !== userId || row.channel !== 'SMS') return { ok: false, error: 'Código inválido ou expirado. Peça um novo código.' }
  const bumped = await prisma.accessCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } })
  const verdict = verifyCode(bumped, code, new Date())
  if (!verdict.ok) {
    if (verdict.block) await prisma.accessCode.update({ where: { id: row.id }, data: { blockedUntil: new Date(Date.now() + CODE_BLOCK_MS) } })
    return { ok: false, error: verdictMessage(verdict) }
  }
  if (bumped.attempts > CODE_MAX_ATTEMPTS) return { ok: false, error: 'Código inválido ou expirado. Peça um novo código.' }
  const consumed = await prisma.accessCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } })
  if (consumed.count === 0) return { ok: false, error: 'Código já utilizado.' }
  await prisma.user.update({ where: { id: userId }, data: { phone: row.phone, phoneVerifiedAt: new Date() } })
  return { ok: true, phoneMask: maskPhone(row.phone) }
}

export async function resendPhoneCode(userId: number, token: string): Promise<{ ok: boolean; echo?: string }> {
  const row = await prisma.accessCode.findUnique({ where: { tokenHash: sha256(token) } })
  if (!row || row.userId !== userId || row.channel !== 'SMS' || row.consumedAt || row.resends >= CODE_MAX_RESENDS || row.expiresAt < new Date()) return { ok: true }
  const code = newCode()
  await prisma.accessCode.update({ where: { id: row.id }, data: { codeHash: sha256(row.purpose === 'SILENT' ? newCode() : code), resends: { increment: 1 }, attempts: 0, expiresAt: new Date(Date.now() + CODE_TTL_MS) } })
  if (row.purpose !== 'SILENT' && row.phone) afterResponse('auth: sms code', () => sendSms(row.phone!, `HouseArt: seu código é ${code}. Vale por 15 minutos.`, 'código PHONE'))
  return { ok: true, ...(codeEchoAllowed() && row.purpose !== 'SILENT' ? { echo: code } : {}) }
}

/** "Esqueci minha senha": blind — always ok; a known active e-mail receives a link that lives 1 h. */
export async function startPasswordReset(rawEmail: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(rawEmail)
  if (!email) return { ok: false, error: 'Informe um e-mail válido.' }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, active: true, passwordHash: true } })
  const token = newToken()
  const purpose = user && user.active ? 'RESET' : 'SILENT'
  await prisma.accessCode.create({ data: { tokenHash: sha256(token), purpose, email, codeHash: sha256(newCode()), userId: user?.id ?? null, expiresAt: new Date(Date.now() + RESET_TTL_MS) } })
  if (purpose === 'RESET') {
    const link = `${publicBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`
    afterResponse('auth: reset e-mail', () => sendEmail({ to: email, subject: 'Redefinir a senha da HouseArt', text: `Recebemos um pedido para redefinir a sua senha. Abra o link em até 1 hora: ${link}\n\nSe você não pediu, ignore esta mensagem; a senha continua a mesma.`, redactedPreview: 'link de redefinição' }))
  }
  return { ok: true }
}

/** Completes the reset: new password, link consumed, every session closed. */
export async function completePasswordReset(token: string, newPassword: string): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const row = await prisma.accessCode.findUnique({ where: { tokenHash: sha256(token) } })
  if (!row || row.purpose !== 'RESET' || row.consumedAt || row.expiresAt < new Date() || !row.userId) return { ok: false, error: 'Link inválido ou expirado. Peça um novo link.' }
  const consumed = await prisma.accessCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } })
  if (consumed.count === 0) return { ok: false, error: 'Link já utilizado.' }
  await prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(newPassword) } })
  await destroyAllSessions(row.userId)
  return { ok: true, email: row.email }
}
