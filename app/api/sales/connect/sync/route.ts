import { NextResponse } from 'next/server'
import { syncConnectAccount } from '@/lib/stripe/connect-server'
import { artworkErrorResponse, connectMember, isResponse } from '../_http'

export const dynamic = 'force-dynamic'

/** The return from Stripe's onboarding (?connect=return) and "Atualizar": re-reads the account and answers its state. */
export async function POST() {
  const m = await connectMember(); if (isResponse(m)) return m
  try { return NextResponse.json({ ok: true, account: await syncConnectAccount(m.memberId) }, { headers: { 'cache-control': 'no-store' } }) } catch (e) { return artworkErrorResponse(e) }
}
