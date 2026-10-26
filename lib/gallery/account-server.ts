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

/** The public-profile phone rule (lib/public-content/editor-core): digits, spaces, +, ( ) and -; landlines welcome. */
const PHONE_LOOSE = /^[0-9+()\-.\s]{8,30}$/

export async function galleryAccount(user: { id: number; tenantRole: string | null; memberId: number | null }, scope: Scope): Promise<GalleryAccountView | null> {
  const tenantId = tenantOfScope(scope)
  if (!tenantId) return null
  const [tenant, me, isAdmin] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, galleryProfile: { select: { tradeName: true, cnpjMask: true, cnpjHash: true } }, publicProfile: { select: { email: true, phone: true, city: true, summary: true } } } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true, phoneVerifiedAt: true } }),
    galleryAdminTenant(scope).then(() => true).catch((e) => { if (e instanceof ContentError || e instanceof ArtworkError) return false; throw e }),
  ])
  if (!tenant) return null
  const p = tenant.publicProfile
  return {
    galleryName: tenant.galleryProfile?.tradeName || tenant.name,
    // the CNPJ lives only in GalleryProfile (mask + hash); Tenant.document is a hash of the person's CPF, never shown
    cnpjMask: tenant.galleryProfile?.cnpjMask ?? null,
    verified: { cnpj: !!tenant.galleryProfile?.cnpjHash, email: !!me?.emailVerifiedAt, phone: !!me?.phoneVerifiedAt },
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
  const phoneRaw = str(r.phone, 30)
  // a mobile is stored masked "(71) 99999-0000"; a landline or another format stays as typed (the public-profile rule)
  const mobile = phoneRaw ? normalizeBrMobile(phoneRaw) : null
  if (phoneRaw && !mobile && !PHONE_LOOSE.test(phoneRaw)) throw new ArtworkError('PHONE', 'Telefone inválido: use só números, espaços, +, ( ) e -.', 422)
  const phone = mobile ? maskPhone(mobile) : phoneRaw || null
  const city = str(r.city, 80)
  const summary = str(r.summary, 200)
  const current = await galleryProfileView(tenantId)
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, galleryProfile: { select: { tradeName: true } } } })
  // `saveGalleryProfile` takes the whole profile (lists included): the view goes back with the four fields changed.
  const next = { ...current, name: current.name || tenant.galleryProfile?.tradeName || tenant.name, email: email || null, phone, city: city || null, summary: summary || null }
  const saved = await saveGalleryProfile(tenantId, next, actor)
  return { email: saved.email ?? '', phone: saved.phone ?? '', city: saved.city ?? '', summary: saved.summary ?? '' }
}
