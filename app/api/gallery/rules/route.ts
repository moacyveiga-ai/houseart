import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rulesOf, saveRules } from '@/lib/gallery/rules-server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '../_http'

const schema = z.object({ refuseLow: z.boolean().optional(), refuseBelowBps: z.number().int().optional(), autoAcceptOn: z.boolean().optional(), autoAcceptMinBps: z.number().int().optional(), responseHours: z.number().int().optional(), notifyTeam: z.boolean().optional() })

export async function GET() {
  const s = await gallerySession(); if (isResponse(s)) return s
  try { return NextResponse.json({ ok: true, rules: await rulesOf(s.scope) }, { headers: { 'cache-control': 'no-store' } }) } catch (e) { return artworkErrorResponse(e) }
}

export async function PUT(req: Request) {
  const s = await gallerySession(); if (isResponse(s)) return s
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  try { return NextResponse.json({ ok: true, rules: await saveRules(s.scope, parsed.data, { userId: s.user.id }) }) } catch (e) { return artworkErrorResponse(e) }
}
