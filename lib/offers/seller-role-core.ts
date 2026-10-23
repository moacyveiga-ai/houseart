// Who of a gallery team may do what as seller — PURE (the screens read it; the
// server enforces the same lists in seller-role-server.ts). `null` = not a
// gallery team member (artist, advisor, collector, staff): never restricted here.
export type SellerRole = 'ADMIN' | 'SALES' | 'INVENTORY'

export const OFFER_ROLES: readonly SellerRole[] = ['ADMIN', 'SALES']
export const LISTING_ROLES: readonly SellerRole[] = ['ADMIN', 'SALES']
export const RULES_ROLES: readonly SellerRole[] = ['ADMIN']
export const TEAM_ROLES_MANAGE: readonly SellerRole[] = ['ADMIN']

const allows = (role: SellerRole | null, list: readonly SellerRole[]) => role === null || list.includes(role)

export interface SellerPermissions { answerOffers: boolean; manageListing: boolean; manageRules: boolean; manageTeam: boolean }

export function sellerPermissions(role: SellerRole | null): SellerPermissions {
  return { answerOffers: allows(role, OFFER_ROLES), manageListing: allows(role, LISTING_ROLES), manageRules: allows(role, RULES_ROLES), manageTeam: allows(role, TEAM_ROLES_MANAGE) }
}

/** The line that explains a hidden action, by what was hidden. */
export const ROLE_REASONS = {
  offers: 'Seu papel na galeria (Acervo) não responde propostas. Quem tem o papel Vendas ou Admin responde.',
  listing: 'Seu papel na galeria (Acervo) não muda preço nem o anúncio. Quem tem o papel Vendas ou Admin muda.',
  rules: 'Só o administrador da galeria muda as regras de ofertas.',
  team: 'Só o administrador da galeria gere a equipe.',
} as const

export function isSellerRole(v: unknown): v is SellerRole {
  return v === 'ADMIN' || v === 'SALES' || v === 'INVENTORY'
}
