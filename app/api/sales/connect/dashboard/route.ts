import { NextResponse } from 'next/server'
import { connectDashboardLink } from '@/lib/stripe/connect-server'
import { artworkErrorResponse, connectMember, isResponse } from '../_http'

export const dynamic = 'force-dynamic'

/** "Abrir painel da Stripe": a one-time login link to the Express dashboard (ENABLED accounts only). */
export async function POST() {
  const m = await connectMember(); if (isResponse(m)) return m
  try { return NextResponse.json({ ok: true, ...(await connectDashboardLink(m.memberId)) }, { headers: { 'cache-control': 'no-store' } }) } catch (e) { return artworkErrorResponse(e) }
}
