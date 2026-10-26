import { NextResponse, type NextRequest } from 'next/server'
import { withJob } from '@/lib/jobs/auth'
import { expireOffers } from '@/lib/offers/server'
import { expireUnpaidEscrows } from '@/lib/deals/server'

export const dynamic = 'force-dynamic'
export const GET = (req: NextRequest) => withJob(req, 'offers-expire', async () => NextResponse.json({ ok: true, expired: await expireOffers(), unpaidDealsCancelled: await expireUnpaidEscrows() }))
export const POST = GET
