import { NextResponse } from 'next/server'
import { configuredProviders } from '@/lib/auth/oauth/core'

/** Which social providers the pages may offer (read by the Entrar/Cadastro islands). */
export async function GET() {
  return NextResponse.json({ ok: true, providers: configuredProviders(process.env).map((p) => p.toLowerCase()) }, { headers: { 'cache-control': 'no-store' } })
}
