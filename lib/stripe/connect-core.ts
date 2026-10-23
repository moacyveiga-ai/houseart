// Stripe Connect — PURE decisions (no prisma, no next, no network). The I/O
// lives in connect-server.ts. What is decided here: the status of a connected
// account from what Stripe says about it, which split line goes to which member,
// the pt-BR labels of the common requirement codes and the payout state a screen
// shows for a split line.
import type { SplitParty } from '@/lib/commission/split-core'

export const CONNECT_ACCOUNT_STATUSES = ['PENDING', 'ONBOARDING', 'RESTRICTED', 'ENABLED', 'DISABLED'] as const
export type ConnectAccountStatus = (typeof CONNECT_ACCOUNT_STATUSES)[number]

/** The slice of a Stripe Account the decisions read (gateway-server.ts gives exactly this). */
export interface AccountSnapshot {
  details_submitted: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  requirements: { currently_due: string[]; past_due: string[]; disabled_reason: string | null }
  /** `capabilities.transfers` when Stripe sends it; null when unknown. */
  transfersCapability: string | null
}

/** Stripe's `requirements.disabled_reason` values that mean "this account will not come back by itself". */
const HARD_DISABLED = ['listed', 'platform_paused', 'other']

/** Whether a transfer to this account would be accepted today. */
export function canReceiveTransfers(a: AccountSnapshot): boolean {
  if (a.transfersCapability !== null) return a.transfersCapability === 'active'
  return a.charges_enabled && a.payouts_enabled
}

/**
 * Status from what Stripe says: a rejected or listed account is DISABLED; before
 * the form is submitted it is ONBOARDING; submitted and able to receive with
 * nothing due is ENABLED; anything else (pending verification, more documents
 * due, capability inactive) is RESTRICTED and the screen lists what is due.
 */
export function connectStatusOf(a: AccountSnapshot): ConnectAccountStatus {
  const reason = a.requirements.disabled_reason ?? ''
  if (reason.startsWith('rejected.') || HARD_DISABLED.includes(reason)) return 'DISABLED'
  if (!a.details_submitted) return 'ONBOARDING'
  if (canReceiveTransfers(a) && a.requirements.currently_due.length === 0 && a.requirements.past_due.length === 0 && !reason) return 'ENABLED'
  return 'RESTRICTED'
}

export const CONNECT_STATUS_LABELS: Record<ConnectAccountStatus, string> = {
  PENDING: 'Não conectado',
  ONBOARDING: 'Cadastro em andamento',
  RESTRICTED: 'Pendências',
  ENABLED: 'Ativa',
  DISABLED: 'Desativada',
}

/** pt-BR for the requirement codes Stripe asks most (the rest shows the code itself, readable enough). */
const REQUIREMENT_LABELS: Record<string, string> = {
  'external_account': 'Conta bancária para receber',
  'tos_acceptance.date': 'Aceite dos termos da Stripe',
  'tos_acceptance.ip': 'Aceite dos termos da Stripe',
  'business_profile.url': 'Site ou perfil do negócio',
  'business_profile.mcc': 'Categoria do negócio',
  'business_profile.product_description': 'Descrição do que você vende',
  'individual.first_name': 'Nome',
  'individual.last_name': 'Sobrenome',
  'individual.dob.day': 'Data de nascimento',
  'individual.dob.month': 'Data de nascimento',
  'individual.dob.year': 'Data de nascimento',
  'individual.id_number': 'CPF',
  'individual.address.line1': 'Endereço',
  'individual.address.city': 'Endereço',
  'individual.address.postal_code': 'Endereço',
  'individual.address.state': 'Endereço',
  'individual.phone': 'Telefone',
  'individual.email': 'E-mail',
  'individual.verification.document': 'Documento de identidade (foto)',
  'individual.verification.additional_document': 'Comprovante de endereço',
  'individual.political_exposure': 'Declaração de pessoa politicamente exposta',
  'company.name': 'Razão social',
  'company.tax_id': 'CNPJ',
  'company.address.line1': 'Endereço da empresa',
  'company.address.city': 'Endereço da empresa',
  'company.address.postal_code': 'Endereço da empresa',
  'company.address.state': 'Endereço da empresa',
  'company.phone': 'Telefone da empresa',
  'company.verification.document': 'Documento da empresa',
  'representative.first_name': 'Representante legal',
  'representative.last_name': 'Representante legal',
  'representative.dob.day': 'Data de nascimento do representante',
  'representative.dob.month': 'Data de nascimento do representante',
  'representative.dob.year': 'Data de nascimento do representante',
  'representative.id_number': 'CPF do representante',
  'representative.verification.document': 'Documento do representante',
  'owners.first_name': 'Sócios da empresa',
  'owners.last_name': 'Sócios da empresa',
  'directors.first_name': 'Diretores da empresa',
  'directors.last_name': 'Diretores da empresa',
}

/** Distinct pt-BR labels for a list of requirement codes, in the order they came (duplicates collapsed). */
export function requirementLabels(codes: readonly string[]): string[] {
  const out: string[] = []
  for (const c of codes) {
    const l = REQUIREMENT_LABELS[c] ?? REQUIREMENT_LABELS[c.replace(/^person_[A-Za-z0-9]+\./, 'representative.')] ?? c
    if (!out.includes(l)) out.push(l)
  }
  return out
}

/** Only strings, bounded: Stripe's `currently_due` as we store it in requirementsJson. */
export function requirementCodesOf(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 120)).slice(0, 60) : []
}

// ── payout of a split line ─────────────────────────────────────────────────
/** The lines that go to someone by Transfer; the platform's own money and the pass-through costs never do. */
export const PAYABLE_PARTIES: readonly SplitParty[] = ['ARTIST', 'GALLERY', 'ADVISOR', 'ARTIST_ROYALTY']
export const isPayableParty = (p: string): p is SplitParty => (PAYABLE_PARTIES as readonly string[]).includes(p)

export interface PayeeContext {
  /** Deal.sellerMemberId — the member that listed the artwork (artist, gallery staff, collector). */
  sellerMemberId: number
  /** Member.kind of the seller. */
  sellerKind: string
  /** The artwork's artist's own member, when that artist has an account (Artist.memberId). */
  artistMemberId: number | null
}

/**
 * Which member a split line is owed to. The seller's own share goes to the seller
 * member (computeSplit names it ARTIST when the seller is an artist and GALLERY
 * otherwise — a collector reselling is a "GALLERY" line too); the artist's share of
 * a gallery sale and the resale royalty go to the artist's own member; ADVISOR has
 * no member on the deal yet (no line is produced today), so nobody.
 */
export function payeeMemberOf(party: string, ctx: PayeeContext): number | null {
  switch (party) {
    case 'ARTIST': return ctx.sellerKind === 'ARTIST' ? ctx.sellerMemberId : ctx.artistMemberId
    case 'GALLERY': return ctx.sellerMemberId
    case 'ARTIST_ROYALTY': return ctx.artistMemberId
    default: return null
  }
}

/**
 * `deal-split:<id>` on the first attempt, `deal-split:<id>:r<n>` after n RECORDED
 * failures. Stripe saves the result of a key for 24 h, errors included: with one
 * key per line a `balance_insufficient` would replay for a day. The counter only
 * moves when a failure was written on the line — a transfer that succeeded at
 * Stripe but whose write here was lost keeps the key and gets the same transfer
 * back, never a second one.
 */
export function transferIdempotencyKey(dealSplitId: number, recordedFailures = 0): string {
  return recordedFailures > 0 ? `deal-split:${dealSplitId}:r${recordedFailures}` : `deal-split:${dealSplitId}`
}

/** A Stripe amount: integer cents, positive, within Stripe's limit. */
export function transferAmountOf(amountCents: bigint): number | null {
  if (amountCents <= 0n || amountCents > 99_999_999n) return null
  return Number(amountCents)
}

/** The Stripe error of a failed transfer, as the column keeps it: the code (or type) only, never the message. */
export function payoutErrorOf(e: unknown): string {
  const x = e as { code?: unknown; type?: unknown; name?: unknown } | null
  const v = [x?.code, x?.type, x?.name].find((s) => typeof s === 'string' && s.trim()) as string | undefined
  return (v ?? 'unknown').slice(0, 80)
}

/** Which transfer-related webhook events we act on (transfer.failed does not exist at Stripe; a reversal is the failure we can see). */
export const CONNECT_EVENTS = ['account.updated', 'transfer.reversed'] as const
export type ConnectEvent = (typeof CONNECT_EVENTS)[number]
export const isConnectEvent = (t: string): t is ConnectEvent => (CONNECT_EVENTS as readonly string[]).includes(t)

// ── what a screen shows for a split line ──────────────────────────────────
export type SplitPayoutState = 'PLATFORM' | 'HELD' | 'STRIPE_PAID' | 'PENDING' | 'FAILED' | 'AWAITING_ACCOUNT' | 'MANUAL'

export const SPLIT_PAYOUT_LABELS: Record<SplitPayoutState, string> = {
  PLATFORM: '',
  HELD: 'em garantia',
  STRIPE_PAID: 'pago pela Stripe',
  PENDING: 'repasse pela Stripe em processamento',
  FAILED: 'repasse pela Stripe falhou · tentaremos de novo',
  AWAITING_ACCOUNT: 'aguardando a conta Stripe',
  MANUAL: 'liberado · repasse manual por Pix',
}

/**
 * The payout state of a split line: from the row (status, error) and from
 * whether the payee has a Connect account (`payee`: null = no account row,
 * otherwise its status).
 */
export function splitPayoutState(line: { party: string; status: string; payoutError: string | null }, payee: ConnectAccountStatus | null | undefined): SplitPayoutState {
  if (!isPayableParty(line.party)) return 'PLATFORM'
  if (line.status === 'HELD') return 'HELD'
  if (line.status === 'PAID') return 'STRIPE_PAID'
  if (line.payoutError) return 'FAILED'
  if (payee === 'ENABLED') return 'PENDING'
  if (payee && payee !== 'DISABLED') return 'AWAITING_ACCOUNT'
  return 'MANUAL'
}
