import { NextResponse, type NextRequest } from 'next/server'
import { withJob } from '@/lib/jobs/auth'
import { anchorDay } from '@/lib/certificates/server'
import { flagOn } from '@/lib/flags'
import { pruneJobRuns } from '@/lib/job-runs/server'

export const dynamic = 'force-dynamic'

/** Daily: merkle root of the events not yet anchored (up to the start of today, house timezone); the job trail is pruned here too. */
export const GET = (req: NextRequest) => withJob(req, 'certificate-anchor', async () => {
  const prunedRuns = await pruneJobRuns()
  if (!flagOn('FLAG_CERTIFICATES')) return NextResponse.json({ ok: true, skipped: 'flag', prunedRuns })
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date())
  return NextResponse.json({ ok: true, ...(await anchorDay(day)), prunedRuns })
})
export const POST = GET
