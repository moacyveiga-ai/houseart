// Stripe Connect — the I/O. Express accounts (Brazil) for the members that sell,
// so the seller's part of a deal reaches them by Transfer from the platform
// balance the moment the deal completes; and the cron that pays what was left
// RELEASED (a seller who onboards AFTER the deal is paid on the next hour).
// Decisions in connect-core.ts; the SDK only through gateway-server.ts
// (injectable in tests). Mock mode refuses everything with 409 — the Pix
// account (lib/payment-methods) keeps being the manual way.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { ArtworkError } from '@/lib/artworks/server'
import { publicBaseUrl } from '@/lib/public-url'
import { BLOCKED_MESSAGES, blockedReason, failureOfError, stripeModeOf, type StripeMode } from './mode-core'
import { stripeGateway, type GwAccount } from './gateway-server'
import { CONNECT_STATUS_LABELS, connectStatusOf, isPayableParty, payeeMemberOf, payoutErrorOf, requirementCodesOf, requirementLabels, transferAmountOf, transferIdempotencyKey, type ConnectAccountStatus } from './connect-core'

export interface ConnectAccountView {
  status: ConnectAccountStatus
  statusLabel: string
  mode: StripeMode
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  /** pt-BR labels of what Stripe still asks (empty when nothing is due). */
  requirements: string[]
  lastSyncedAt: string | null
}

const NOT_CONNECTED: Omit<ConnectAccountView, 'mode'> = { status: 'PENDING', statusLabel: CONNECT_STATUS_LABELS.PENDING, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false, requirements: [], lastSyncedAt: null }

function mode(): StripeMode { return stripeModeOf(process.env) }

/** Connect only exists in test/live (and not blocked in the real production). */
export function connectAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return stripeModeOf(env) !== 'mock' && blockedReason(env) === null
}

function assertConnect(): StripeMode {
  const r = blockedReason(process.env)
  if (r) throw new ArtworkError('STRIPE_BLOCKED', BLOCKED_MESSAGES[r], 409)
  const m = mode()
  if (m === 'mock') throw new ArtworkError('STRIPE_MOCK', 'A conta Stripe não está ligada neste ambiente. O repasse segue pela chave Pix.', 409)
  return m
}

function stripeFailure(e: unknown): ArtworkError {
  if (e instanceof ArtworkError) return e
  const f = failureOfError(e as { type?: string; code?: string })
  // a Connect call that fails is never a card problem: say so in the seller's words
  return new ArtworkError(f.status === 503 ? 'PAYMENT_UNAVAILABLE' : 'CONNECT_FAILED', f.status === 503 ? f.message : 'A Stripe não aceitou a operação. Tente de novo em instantes.', f.status === 503 ? 503 : 502)
}

type AccountRow = NonNullable<Awaited<ReturnType<typeof prisma.stripeConnectAccount.findUnique>>>

function toView(row: AccountRow | null, m: StripeMode): ConnectAccountView {
  if (!row || row.mode !== m) return { ...NOT_CONNECTED, mode: m }
  const status = row.status as ConnectAccountStatus
  return {
    status, statusLabel: CONNECT_STATUS_LABELS[status] ?? status, mode: m, chargesEnabled: row.chargesEnabled, payoutsEnabled: row.payoutsEnabled, detailsSubmitted: row.detailsSubmitted,
    requirements: requirementLabels(requirementCodesOf(JSON.parse(row.requirementsJson || '[]'))), lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  }
}

/** The member's account as the screen shows it; "Não conectado" in mock mode, without an account, or with one of another mode. */
export async function connectAccountView(memberId: number): Promise<ConnectAccountView> {
  const m = mode()
  if (m === 'mock') return { ...NOT_CONNECTED, mode: m }
  return toView(await prisma.stripeConnectAccount.findUnique({ where: { memberId } }), m)
}

function dataOf(a: GwAccount, m: StripeMode) {
  return {
    mode: m, status: connectStatusOf(a), chargesEnabled: a.charges_enabled, payoutsEnabled: a.payouts_enabled, detailsSubmitted: a.details_submitted,
    requirementsJson: JSON.stringify(requirementCodesOf([...a.requirements.currently_due, ...a.requirements.past_due.filter((c) => !a.requirements.currently_due.includes(c))])),
    disabledReason: a.requirements.disabled_reason?.slice(0, 80) ?? null, lastSyncedAt: new Date(),
  }
}

/**
 * The member's Express account in the current mode, created once (one per member;
 * a row of the other mode is replaced — the test account means nothing live).
 * The person must have a login e-mail: Stripe sends the onboarding there.
 */
export async function ensureConnectAccount(memberId: number): Promise<AccountRow> {
  const m = assertConnect()
  const existing = await prisma.stripeConnectAccount.findUnique({ where: { memberId } })
  if (existing && existing.mode === m) return existing
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, tenantId: true, kind: true, displayName: true, user: { select: { email: true } }, tenant: { select: { kind: true } } } })
  if (!member) throw new ArtworkError('NOT_FOUND', 'Membro não encontrado.', 404)
  if (!member.user?.email) throw new ArtworkError('NO_EMAIL', 'A conta Stripe precisa de um login com e-mail.', 409)
  let a: GwAccount
  try {
    a = await stripeGateway().createAccount({ email: member.user.email, business_type: member.tenant.kind === 'GALLERY' ? 'company' : 'individual', metadata: { memberId: String(memberId), tenantId: String(member.tenantId), kind: member.kind } }, `connect:${m}:${memberId}`)
  } catch (e) { throw stripeFailure(e) }
  const data = { ...dataOf(a, m), status: 'PENDING' as const, tenantId: member.tenantId, accountId: a.id }
  const row = existing
    ? await prisma.stripeConnectAccount.update({ where: { id: existing.id }, data })
    : await prisma.stripeConnectAccount.upsert({ where: { memberId }, create: { memberId, ...data }, update: data })
  void audit.event({ entity: 'stripe_connect_account', entityId: row.id, action: 'create', after: { memberId, mode: m, replaced: existing?.accountId ?? null } })
  return row
}

/** The hosted onboarding link (expires in minutes; a new one each click). The row moves to ONBOARDING. */
export async function startOnboarding(memberId: number): Promise<{ url: string }> {
  const row = await ensureConnectAccount(memberId)
  if (row.status === 'DISABLED') throw new ArtworkError('CONNECT_DISABLED', 'A Stripe desativou esta conta. Fale com a HouseArt.', 409)
  const base = publicBaseUrl()
  let link: { url: string }
  try { link = await stripeGateway().createAccountLink({ account: row.accountId, refresh_url: `${base}/sales/payout?connect=refresh`, return_url: `${base}/sales/payout?connect=return` }) }
  catch (e) { throw stripeFailure(e) }
  if (row.status === 'PENDING') await prisma.stripeConnectAccount.updateMany({ where: { id: row.id, status: 'PENDING' }, data: { status: 'ONBOARDING' } })
  return { url: link.url }
}

/** Re-reads the account at Stripe and stores status and flags (the return from onboarding, the "Atualizar" button). */
export async function syncConnectAccount(memberId: number): Promise<ConnectAccountView> {
  const m = assertConnect()
  const row = await prisma.stripeConnectAccount.findUnique({ where: { memberId } })
  if (!row || row.mode !== m) return { ...NOT_CONNECTED, mode: m }
  let a: GwAccount
  try { a = await stripeGateway().retrieveAccount(row.accountId) } catch (e) { throw stripeFailure(e) }
  const updated = await prisma.stripeConnectAccount.update({ where: { id: row.id }, data: dataOf(a, m) })
  if (updated.status !== row.status) void audit.event({ entity: 'stripe_connect_account', entityId: row.id, action: 'status', before: { status: row.status }, after: { status: updated.status } })
  return toView(updated, m)
}

/** The webhook's `account.updated`: the same sync from the event's object (no call to Stripe). Unknown account = nothing. */
export async function syncConnectAccountFromEvent(a: GwAccount, m: StripeMode): Promise<boolean> {
  const row = await prisma.stripeConnectAccount.findUnique({ where: { accountId: a.id } })
  if (!row || row.mode !== m) return false
  await prisma.stripeConnectAccount.update({ where: { id: row.id }, data: dataOf(a, m) })
  return true
}

/** The Express dashboard login link — only for an ENABLED account. */
export async function connectDashboardLink(memberId: number): Promise<{ url: string }> {
  const m = assertConnect()
  const row = await prisma.stripeConnectAccount.findUnique({ where: { memberId } })
  if (!row || row.mode !== m || row.status !== 'ENABLED') throw new ArtworkError('CONNECT_NOT_ENABLED', 'O painel da Stripe abre depois que a conta está ativa.', 409)
  try { return await stripeGateway().createLoginLink(row.accountId) } catch (e) { throw stripeFailure(e) }
}

// ── payout of the split ────────────────────────────────────────────────────
export interface PayoutSummary { paid: number; skipped: number; failed: number }

interface SplitRow { id: number; dealId: number; party: string; amountCents: bigint; status: string; payoutError: string | null; payoutAttempts: number }

/**
 * The ENABLED account that receives a split line, or null (the line stays
 * RELEASED and the manual Pix payout applies). The GALLERY line of a gallery
 * sale may be connected by the gallery's ADMIN rather than by the staff member
 * who listed the artwork: any ENABLED account of a GALLERY_STAFF member of the
 * deal's tenant serves, the seller's own first, then the admins'.
 */
async function payeeAccountOf(split: SplitRow, deal: { sellerMemberId: number; tenantId: number | null; sellerKind: string; artistMemberId: number | null }, m: StripeMode): Promise<{ accountId: string; memberId: number } | null> {
  const memberId = payeeMemberOf(split.party, { sellerMemberId: deal.sellerMemberId, sellerKind: deal.sellerKind, artistMemberId: deal.artistMemberId })
  if (memberId === null) return null
  const own = await prisma.stripeConnectAccount.findFirst({ where: { memberId, mode: m, status: 'ENABLED' }, select: { accountId: true, memberId: true } })
  if (own) return own
  if (split.party !== 'GALLERY' || deal.sellerKind !== 'GALLERY_STAFF' || !deal.tenantId) return null
  const admins = await prisma.member.findMany({ where: { tenantId: deal.tenantId, kind: 'GALLERY_STAFF', status: 'ACTIVE', OR: [{ role: 'ADMIN' }, { user: { tenantRole: 'ADMIN' } }] }, select: { id: true }, orderBy: { id: 'asc' } })
  if (admins.length === 0) return null
  return prisma.stripeConnectAccount.findFirst({ where: { memberId: { in: admins.map((x) => x.id) }, mode: m, status: 'ENABLED' }, select: { accountId: true, memberId: true }, orderBy: { id: 'asc' } })
}

async function dealOfSplit(dealId: number) {
  const d = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true, code: true, sellerMemberId: true, tenantId: true, phase: true, exceptionStatus: true, artwork: { select: { member: { select: { kind: true } }, artist: { select: { memberId: true } } } } } })
  if (!d) return null
  return { id: d.id, code: d.code, sellerMemberId: d.sellerMemberId, tenantId: d.tenantId, phase: d.phase, exceptionStatus: d.exceptionStatus, sellerKind: d.artwork.member.kind, artistMemberId: d.artwork.artist.memberId }
}

/**
 * Pays one RELEASED line by Transfer. Never throws: a Stripe refusal is written
 * on the line (payoutError, the code only) and the line stays RELEASED for the
 * next run; the same idempotency key on every run keeps Stripe at one transfer.
 */
async function paySplit(split: SplitRow, m: StripeMode): Promise<'paid' | 'skipped' | 'failed'> {
  const deal = await dealOfSplit(split.dealId)
  // only a deal that really completed pays out (never a cancelled or disputed one)
  if (!deal || deal.phase !== 'COMPLETED' || deal.exceptionStatus) return 'skipped'
  const payee = await payeeAccountOf(split, deal, m)
  if (!payee) return 'skipped'
  const amount = transferAmountOf(split.amountCents)
  if (amount === null) { await prisma.dealSplit.updateMany({ where: { id: split.id, status: 'RELEASED', payoutError: null }, data: { payoutError: 'amount_out_of_range' } }); return 'failed' }
  try {
    const t = await stripeGateway().createTransfer({ amount, currency: 'brl', destination: payee.accountId, transfer_group: deal.code, metadata: { dealId: String(deal.id), dealSplitId: String(split.id), party: split.party, memberId: String(payee.memberId) } }, transferIdempotencyKey(split.id, split.payoutAttempts))
    const r = await prisma.dealSplit.updateMany({ where: { id: split.id, status: 'RELEASED' }, data: { status: 'PAID', payoutRef: t.id, transferredAt: new Date(), payoutError: null } })
    if (r.count && split.party === 'ARTIST_ROYALTY') await prisma.royaltyPayment.updateMany({ where: { dealId: deal.id, status: { in: ['PENDING', 'HELD'] } }, data: { status: 'PAID', paidAt: new Date(), receiptRef: t.id } })
    void audit.event({ entity: 'deal_split', entityId: split.id, action: 'transfer', after: { dealCode: deal.code, party: split.party, amountCents: split.amountCents.toString(), transfer: t.id, memberId: payee.memberId } })
    return 'paid'
  } catch (e) {
    const code = payoutErrorOf(e)
    console.warn('[stripe] transfer falhou', deal.code, split.party, code)
    await prisma.dealSplit.updateMany({ where: { id: split.id, status: 'RELEASED' }, data: { payoutError: code, payoutAttempts: { increment: 1 } } }).catch(() => null)
    return 'failed'
  }
}

async function payRows(rows: SplitRow[], m: StripeMode): Promise<PayoutSummary> {
  const sum: PayoutSummary = { paid: 0, skipped: 0, failed: 0 }
  for (const s of rows) {
    if (!isPayableParty(s.party)) { sum.skipped += 1; continue }
    sum[await paySplit(s, m)] += 1
  }
  return sum
}

/** RELEASED payable lines, except the ones whose transfer Stripe reversed (same key = same reversed transfer; those are a manual decision). */
const PAYABLE_WHERE = { status: 'RELEASED', party: { in: ['ARTIST', 'GALLERY', 'ADVISOR', 'ARTIST_ROYALTY'] }, OR: [{ payoutError: null }, { payoutError: { not: 'transfer_reversed' } }] }

/** The RELEASED lines of ONE deal (called after the completion commits, and by the retry route). No-op in mock mode. */
export async function payDealSplits(dealId: number): Promise<PayoutSummary> {
  if (!connectAvailable()) return { paid: 0, skipped: 0, failed: 0 }
  const m = mode()
  return totalScope('connect:pay-deal', async () => {
    const rows = await prisma.dealSplit.findMany({ where: { dealId, ...PAYABLE_WHERE }, orderBy: { id: 'asc' } })
    return payRows(rows, m)
  })
}

/** The cron: every RELEASED payable line of the base, oldest first, up to `limit` — a seller who connects later is paid here. */
export async function payReleasedSplits(limit = 50): Promise<PayoutSummary> {
  if (!connectAvailable()) return { paid: 0, skipped: 0, failed: 0 }
  const m = mode()
  return totalScope('connect:pay-released', async () => {
    const rows = await prisma.dealSplit.findMany({ where: PAYABLE_WHERE, orderBy: { id: 'asc' }, take: Math.max(1, Math.min(limit, 500)) })
    return payRows(rows, m)
  })
}

/**
 * The webhook's `transfer.reversed`: the line goes back to RELEASED with `transfer_reversed`.
 * The idempotency key is per split, so an automatic retry would only replay the reversed
 * transfer: the cron skips this error and paying again is a manual decision (Pix, or a new
 * transfer from the Stripe dashboard). payoutRef stays as history.
 */
export async function markTransferReversed(transferId: string): Promise<boolean> {
  const r = await prisma.dealSplit.updateMany({ where: { payoutRef: transferId, status: 'PAID' }, data: { status: 'RELEASED', payoutError: 'transfer_reversed', transferredAt: null } })
  return r.count > 0
}
