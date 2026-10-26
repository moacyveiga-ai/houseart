import { NextResponse, type NextRequest } from 'next/server'
import { withJob } from '@/lib/jobs/auth'
import { refreshMarketIndicators } from '@/lib/market-indicators/server'

export const dynamic = 'force-dynamic'
/** The header ticker: dollar, euro (AwesomeAPI / PTAX) and the HouseArt index (platform sales). */
export const GET = (req: NextRequest) => withJob(req, 'market-indicators', async () => NextResponse.json({ ok: true, ...(await refreshMarketIndicators()) }))
export const POST = GET
