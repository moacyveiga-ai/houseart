import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, AuthError } from '@/lib/auth'
import { readPreferences, savePreferences, saveTheme } from '@/lib/accounts/preferences-server'

const schema = z.object({
  uses: z.array(z.string().max(40)).max(10).optional(),
  interests: z.array(z.string().max(40)).max(20).optional(),
  city: z.string().trim().max(80).optional(),
  marketingOptIn: z.boolean().optional(),
  termsAccepted: z.literal(true).optional(),
  theme: z.enum(['light', 'pastel', 'dark', 'system']).optional(),
})

export async function GET() {
  try { const user = await requireAuth(); return NextResponse.json({ ok: true, ...(await readPreferences(user.id)) }) }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false }, { status: 401 }); throw e }
}

/** Onboarding step of the signup (interests, uses, city, newsletter), the terms acceptance and the theme of Perfil › Aparência. */
export async function PATCH(req: Request) {
  let user
  try { user = await requireAuth() } catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false, error: 'Entre para continuar.' }, { status: 401 }); throw e }
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  const { theme, ...rest } = parsed.data
  if (theme) await saveTheme(user.id, theme)
  return NextResponse.json({ ok: true, ...(await savePreferences(user.id, rest)) })
}
