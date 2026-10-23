import { NextResponse } from 'next/server'
import { startOnboarding } from '@/lib/stripe/connect-server'
import { artworkErrorResponse, connectMember, isResponse } from '../_http'

export const dynamic = 'force-dynamic'

/** "Conectar conta" / "Continuar cadastro": the hosted onboarding URL of the member's Express account (created on the first call). */
export async function POST() {
  const m = await connectMember(); if (isResponse(m)) return m
  try { return NextResponse.json({ ok: true, ...(await startOnboarding(m.memberId)) }, { headers: { 'cache-control': 'no-store' } }) } catch (e) { return artworkErrorResponse(e) }
}
