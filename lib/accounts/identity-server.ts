// The buyer's identity for an offer (handoff "Confirme sua identidade"): CPF,
// verified phone, verified e-mail. The CPF is stored once and shown as a mask.
import { prisma } from '@/lib/prisma'
import { maskPhone } from '@/lib/sms/core'

export interface IdentityView { name: string; cpfMask: string | null; phoneMask: string | null; phoneVerified: boolean; emailVerified: boolean; city: string }

const maskCpf = (d: string) => `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`

export async function identityOf(userId: number): Promise<IdentityView> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, cpf: true, phone: true, phoneVerifiedAt: true, emailVerifiedAt: true, preferencesJson: true } })
  let city = ''
  try { city = String((JSON.parse(u.preferencesJson) as { city?: unknown }).city ?? '') } catch { city = '' }
  return { name: u.name, cpfMask: u.cpf ? maskCpf(u.cpf) : null, phoneMask: u.phone ? maskPhone(u.phone) : null, phoneVerified: !!u.phoneVerifiedAt, emailVerified: !!u.emailVerifiedAt, city }
}

function validCpf(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false
  const calc = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

/** Sets the CPF once (never overwritten) and the city. Blind on a CPF already taken by another account. */
export async function setIdentity(userId: number, input: { cpf?: string | null; city?: string | null; name?: string | null }): Promise<{ ok: true; identity: IdentityView } | { ok: false; error: string }> {
  const d = (input.cpf ?? '').replace(/\D/g, '')
  if (d) {
    if (!validCpf(d)) return { ok: false, error: 'CPF inválido.' }
    const me = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { cpf: true } })
    if (me.cpf && me.cpf !== d) return { ok: false, error: 'O CPF desta conta já foi informado.' }
    if (!me.cpf) {
      const taken = await prisma.user.findFirst({ where: { cpf: d, id: { not: userId } }, select: { id: true } })
      if (taken) return { ok: false, error: 'Não foi possível confirmar este CPF.' }
      await prisma.user.update({ where: { id: userId }, data: { cpf: d } })
    }
  }
  if (typeof input.name === 'string') {
    const name = input.name.replace(/\s+/g, ' ').trim()
    if (name.length < 2 || name.length > 80) return { ok: false, error: 'Informe o nome completo.' }
    await prisma.user.update({ where: { id: userId }, data: { name } })
  }
  if (typeof input.city === 'string') {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { preferencesJson: true } })
    let prefs: Record<string, unknown> = {}
    try { prefs = JSON.parse(u.preferencesJson) as Record<string, unknown> } catch { prefs = {} }
    await prisma.user.update({ where: { id: userId }, data: { preferencesJson: JSON.stringify({ ...prefs, city: input.city.trim().slice(0, 80) }) } })
  }
  return { ok: true, identity: await identityOf(userId) }
}
