import { NextResponse } from 'next/server'
import { followLink } from '@/lib/instagram/server'
import { publicBaseUrl } from '@/lib/public-url'

export const dynamic = 'force-dynamic'

/** The short link of an Instagram caption: counts the visit and opens the public page of the artwork. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const target = await followLink((await ctx.params).code).catch(() => null)
  return NextResponse.redirect(`${publicBaseUrl()}${target ?? '/e'}`, { headers: { 'cache-control': 'no-store' } })
}
