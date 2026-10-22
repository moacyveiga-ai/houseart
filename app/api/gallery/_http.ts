import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { AuthError } from '@/lib/auth'

/** The gallery routes: a panel session (401/403 as the guard says) — the module decides the rest. */
export async function gallerySession() {
  try { return await requirePanel() } catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status ?? 401 }); throw e }
}
export const isResponse = (v: unknown): v is NextResponse => v instanceof NextResponse
