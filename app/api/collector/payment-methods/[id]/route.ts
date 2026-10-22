import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { removeCard, setDefaultCard } from '@/lib/payment-methods/server'

async function who() { try { return await requireAuth() } catch (e) { if (e instanceof AuthError) return null; throw e } }
const idOf = async (ctx: { params: Promise<{ id: string }> }) => { const n = Number((await ctx.params).id); return Number.isInteger(n) && n > 0 && n < 2_147_483_647 ? n : null }

/** PATCH {default:true} → makes it the default card. */
export async function PATCH(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await who(); if (!u) return NextResponse.json({ ok: false }, { status: 401 })
  const id = await idOf(ctx); if (!id) return NextResponse.json({ ok: false }, { status: 404 })
  const ok = await setDefaultCard(u.id, id)
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await who(); if (!u) return NextResponse.json({ ok: false }, { status: 401 })
  const id = await idOf(ctx); if (!id) return NextResponse.json({ ok: false }, { status: 404 })
  const ok = await removeCard(u.id, id)
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 })
}
