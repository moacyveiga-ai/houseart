import { NextResponse, type NextRequest } from 'next/server'
import { withJob } from '@/lib/jobs/auth'
import { anchorDay } from '@/lib/certificates/server'
import { flagOn } from '@/lib/flags'

export const dynamic = 'force-dynamic'

/** Daily: merkle root of the events not yet anchored (up to the start of today, house timezone). */
export const GET = (req: NextRequest) => withJob(req, 'certificate-anchor', async () => {
  if (!flagOn('FLAG_CERTIFICATES')) return NextResponse.json({ ok: true, skipped: 'flag' })
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date())
  return NextResponse.json({ ok: true, ...(await anchorDay(day)) })
})
export const POST = GET
