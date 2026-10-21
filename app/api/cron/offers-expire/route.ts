import { NextResponse, type NextRequest } from 'next/server'
import { withJob } from '@/lib/jobs/auth'
import { expireOffers } from '@/lib/offers/server'

export const dynamic = 'force-dynamic'
export const GET = (req: NextRequest) => withJob(req, 'offers-expire', async () => NextResponse.json({ ok: true, expired: await expireOffers() }))
export const POST = GET
