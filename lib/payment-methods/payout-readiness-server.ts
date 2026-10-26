// "Cadastre o Pix para receber antes de aceitar" / "Publicar sem Pix abre o cadastro de Pix" (handoff
// App Colecionador › Vendas, Vender uma obra): a seller is READY to receive when the house can pay
// the split line — a Stripe Connect account ENABLED in the current mode, or an active Pix key. The
// collector's screens gate accepting an offer and publishing a listing on it; the server never does
// (a sale with no payout account simply waits as RELEASED for the Pix, as it always did).
import { prisma } from '@/lib/prisma'
import { stripeModeOf } from '@/lib/stripe/mode-core'
import { connectAvailable } from '@/lib/stripe/connect-server'

export type PayoutReadiness = { ready: true; via: 'stripe' | 'pix' } | { ready: false; via: null }

export async function payoutReadiness(memberId: number): Promise<PayoutReadiness> {
  // the same gate the payout itself has (`payDealSplits`): Connect counts only where it is available
  const m = stripeModeOf(process.env)
  const [pix, stripe] = await Promise.all([
    prisma.payoutAccount.count({ where: { memberId, status: 'ACTIVE' } }),
    connectAvailable() ? prisma.stripeConnectAccount.count({ where: { memberId, mode: m, status: 'ENABLED' } }) : Promise.resolve(0),
  ])
  if (stripe > 0) return { ready: true, via: 'stripe' }
  if (pix > 0) return { ready: true, via: 'pix' }
  return { ready: false, via: null }
}
