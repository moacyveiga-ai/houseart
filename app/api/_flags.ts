import { NextResponse } from 'next/server'
import { flagOn, type FlagName } from '@/lib/flags'

/** A module behind a flag answers 404 BEFORE the session (the module does not exist). */
export function flagGate(name: FlagName): NextResponse | null {
  return flagOn(name) ? null : NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
}
