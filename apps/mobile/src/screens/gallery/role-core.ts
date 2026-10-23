// What the gallery team role lets the app show — PURE. The same lists the
// server enforces (`lib/offers/seller-role-core.ts` in the root): Admin does
// everything, Vendas answers proposals and manages the listing, Acervo only
// registers and certifies. `null` = not on a gallery team (artist, advisor,
// collector): nothing is hidden. The server stays the authority: a 403 still
// shows its message.
import type { TeamRole } from '@/auth/types'

export interface RolePermissions { answerOffers: boolean; manageListing: boolean; manageRules: boolean; manageTeam: boolean }

export function rolePermissions(role: TeamRole | null | undefined): RolePermissions {
  if (!role || role === 'ADMIN') return { answerOffers: true, manageListing: true, manageRules: true, manageTeam: true }
  if (role === 'SALES') return { answerOffers: true, manageListing: true, manageRules: false, manageTeam: false }
  return { answerOffers: false, manageListing: false, manageRules: false, manageTeam: false }
}

/** The line that explains a hidden action (same text as the web). */
export const ROLE_REASONS = {
  offers: 'Seu papel na galeria (Acervo) não responde propostas. Quem tem o papel Vendas ou Admin responde.',
  listing: 'Seu papel na galeria (Acervo) não muda preço nem o anúncio. Quem tem o papel Vendas ou Admin muda.',
  rules: 'Só o administrador da galeria muda as regras de ofertas.',
  team: 'Só o administrador da galeria gere a equipe.',
} as const

/** The tabs of Negócios for the role: Regras only for who changes them. */
export function salesTabs(p: RolePermissions): readonly ('offers' | 'deals' | 'rules')[] {
  return p.manageRules ? ['offers', 'deals', 'rules'] : ['offers', 'deals']
}
