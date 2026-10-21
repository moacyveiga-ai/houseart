import { flagGate } from '@/app/api/_flags'
import { appraisalQueue } from '@/lib/appraisal/server'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'
import { requireAppraiser } from '../_guard'

export async function GET() {
  const gate = flagGate('FLAG_APPRAISAL'); if (gate) return gate
  try {
    await requireAppraiser()
    return json(await appraisalQueue())
  } catch (e) { return artworkErrorResponse(e) }
}
