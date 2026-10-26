import { NextResponse, type NextRequest } from 'next/server'
import { withJob } from '@/lib/jobs/auth'
import { runInstagramCron } from '@/lib/instagram/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120
/** Instagram: renews tokens close to expiry, resends what a lost after() left pending, reads the reach. */
export const GET = (req: NextRequest) => withJob(req, 'instagram', async () => NextResponse.json({ ok: true, ...(await runInstagramCron()) }))
export const POST = GET
