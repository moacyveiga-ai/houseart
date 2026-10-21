import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePanel } from '@/lib/auth/panel'
import { createContact } from '@/lib/crm/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().max(254).optional(), phone: z.string().max(30).optional(), city: z.string().max(80).optional(), interest: z.string().max(200).optional(), valueCents: z.union([z.number(), z.string()]).optional() })

export async function POST(req: Request) {
  try {
    const { scope } = await requirePanel()
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    const v = parsed.data.valueCents === undefined ? null : BigInt(Math.round(Number(String(parsed.data.valueCents).replace(/[^\d.]/g, ''))))
    const r = await createContact(scope, { ...parsed.data, valueCents: v })
    return NextResponse.json({ ok: true, contactId: r.contact.id, opportunityId: r.opportunity.id }, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
