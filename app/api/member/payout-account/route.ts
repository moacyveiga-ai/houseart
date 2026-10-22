import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, AuthError } from '@/lib/auth'
import { payoutAccountOf, removePayoutAccount, setPayoutAccount } from '@/lib/payment-methods/server'

const schema = z.object({ type: z.string().max(10), key: z.string().max(80), holderName: z.string().max(120) })

async function member() { try { const u = await requireAuth(); return u.memberId ? u : null } catch (e) { if (e instanceof AuthError) return null; throw e } }

/** The seller's Pix key for receiving sales (one per member). */
export async function GET() {
  const u = await member(); if (!u) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true, account: await payoutAccountOf(u.memberId!) }, { headers: { 'cache-control': 'no-store' } })
}

export async function PUT(req: Request) {
  const u = await member(); if (!u) return NextResponse.json({ ok: false, error: 'Só membros recebem vendas.' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Dados incompletos.' }, { status: 400 })
  const r = await setPayoutAccount(u.memberId!, u.tenantId ?? null, { ...parsed.data, holderDocument: u.cpf ?? null })
  if (!r.ok) return NextResponse.json(r, { status: 400 })
  return NextResponse.json(r)
}

export async function DELETE() {
  const u = await member(); if (!u) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: await removePayoutAccount(u.memberId!) })
}
