import { NextResponse, type NextRequest } from 'next/server'
import { withJob } from '@/lib/jobs/auth'
import { resumeStuckDeliveries } from '@/lib/deals/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120
/** Hourly: a deal whose buyer's tap was valid but whose deed failed afterwards (stuck in DELIVERY) is completed. */
export const GET = (req: NextRequest) => withJob(req, 'deal-complete-retry', async () => NextResponse.json({ ok: true, ...(await resumeStuckDeliveries()) }))
export const POST = GET
