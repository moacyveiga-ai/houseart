import { NextResponse, type NextRequest } from 'next/server'
import { withJob } from '@/lib/jobs/auth'
import { payReleasedSplits } from '@/lib/stripe/connect-server'

export const dynamic = 'force-dynamic'
/** Hourly: the RELEASED split lines whose payee has an ENABLED Connect account are paid by Transfer (no-op in mock mode). */
export const GET = (req: NextRequest) => withJob(req, 'connect-payouts', async () => NextResponse.json({ ok: true, ...(await payReleasedSplits(100)) }))
export const POST = GET
