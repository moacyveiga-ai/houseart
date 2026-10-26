// Conta da galeria › Dados da galeria (handoff "HouseArt Web Galeria" › Galeria › Conta): what the
// header shows (the gallery's name, who is verified) and the form the ADMIN saves — name and CNPJ are
// locked (they come from the signup); e-mail, phone, city and the one-line summary go to the public
// profile of the gallery (the same row /gallery/public edits), so the site and the card agree.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { tenantOfScope, type Scope } from '@/lib/scope/core'
import { ArtworkError } from '@/lib/artworks/server'
import { galleryAdminTenant, galleryProfileView, saveGalleryProfile } from '@/lib/public-content/editor-server'
import { ContentError } from '@/lib/public-content/editor-core'
import { maskPhone, normalizeBrMobile } from '@/lib/sms/core'

export interface GalleryAccountView {
  galleryName: string
  cnpjMask: string | null
  verified: { cnpj: boolean; email: boolean; phone: boolean }
  /** the editable fields (public profile); null when the gallery has no public profile row yet */
  data: { email: string; phone: string; city: string; summary: string }
  isAdmin: boolean
}

/** "12345678000190" → "12.345.678/0001-90" (the gallery's own document; shown only to its staff). */
export function formatCnpj(digits: string | null | undefined): string | null {
  const d = (digits ?? '').replace(/\D/g, '')
  if (d.length !== 14) return null
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export async function galleryAccount(user: { id: number; tenantRole: string | null; memberId: number | null }, scope: Scope): Promise<GalleryAccountView | null> {
  const tenantId = tenantOfScope(scope)
  if (!tenantId) return null
  const [tenant, me, isAdmin] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, document: true, galleryProfile: { select: { tradeName: true, cnpjMask: true, cnpjHash: true } }, publicProfile: { select: { email: true, phone: true, city: true, summary: true } } } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true, phoneVerifiedAt: true } }),
    galleryAdminTenant(scope).then(() => true).catch((e) => { if (e instanceof ContentError || e instanceof ArtworkError) return false; throw e }),
  ])
  if (!tenant) return null
  const p = tenant.publicProfile
  return {
    galleryName: tenant.galleryProfile?.tradeName || tenant.name,
    cnpjMask: tenant.galleryProfile?.cnpjMask ?? formatCnpj(tenant.document),
    verified: { cnpj: !!(tenant.galleryProfile?.cnpjHash || tenant.document), email: !!me?.emailVerifiedAt, phone: !!me?.phoneVerifiedAt },
    data: { email: p?.email ?? '', phone: p?.phone ?? '', city: p?.city ?? '', summary: p?.summary ?? '' },
    isAdmin,
  }
}

/** The ADMIN saves e-mail, phone, city and summary; everything else of the public profile stays as it is. */
export async function saveGalleryAccountData(scope: Scope, raw: unknown, actor: { userId: number; name: string; ip?: string; userAgent?: string }): Promise<GalleryAccountView['data']> {
  const tenantId = await galleryAdminTenant(scope)
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const email = str(r.email, 160)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ArtworkError('EMAIL', 'E-mail inválido.', 422)
  const phoneRaw = str(r.phone, 32)
  const phone = phoneRaw ? normalizeBrMobile(phoneRaw) : null
  if (phoneRaw && !phone) throw new ArtworkError('PHONE', 'Celular inválido: use DDD e o número com 9 dígitos.', 422)
  const city = str(r.city, 80)
  const summary = str(r.summary, 200)
  const current = await galleryProfileView(tenantId)
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, galleryProfile: { select: { tradeName: true } } } })
  // `saveGalleryProfile` takes the whole profile (lists included): the view goes back with the four fields changed.
  const next = { ...current, name: current.name || tenant.galleryProfile?.tradeName || tenant.name, email: email || null, phone: phone ? maskPhone(phone) : null, city: city || null, summary: summary || null }
  const saved = await saveGalleryProfile(tenantId, next, actor)
  return { email: saved.email ?? '', phone: saved.phone ?? '', city: saved.city ?? '', summary: saved.summary ?? '' }
}
