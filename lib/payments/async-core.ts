// Pix and boleto for the escrow of a deal (handoff "Web Colecionador" › Comprar: Pix "aprovação na
// hora", Boleto "1 dia útil"). PURE: methods, deadlines, the instructions the buyer sees, the boleto
// billing check and the mock codes. The money only counts as paid when the provider says so
// (webhook in test/live; "Simular pagamento" in mock) — never on the buyer's word.

export const ASYNC_METHODS = ['PIX', 'BOLETO'] as const
export type AsyncMethod = (typeof ASYNC_METHODS)[number]
export const isAsyncMethod = (v: unknown): v is AsyncMethod => typeof v === 'string' && (ASYNC_METHODS as readonly string[]).includes(v)

export const ESCROW_METHODS = ['CARD', 'PIX', 'BOLETO'] as const
export type EscrowMethod = (typeof ESCROW_METHODS)[number]

/** Pix lives 24 h (the escrow window); a boleto 3 days (it clears in ~1 business day after paid). */
export const PIX_TTL_SECONDS = 24 * 3600
export const BOLETO_DAYS = 3

export function expiresAtFor(method: AsyncMethod, now: Date): Date {
  return new Date(now.getTime() + (method === 'PIX' ? PIX_TTL_SECONDS * 1000 : BOLETO_DAYS * 86_400_000))
}

/** What the buyer needs to pay — stored on the deal as JSON and shown on Compras. */
export interface PaymentInstructions {
  method: AsyncMethod
  amountCents: string
  expiresAt: string
  /** Pix "copia e cola" (EMV) — the QR encodes the same string. */
  pixCode?: string | null
  /** A PNG of the QR: the provider's URL, or a data: URL drawn by us in mock. */
  pixQrUrl?: string | null
  /** Boleto "linha digitável" and its PDF. */
  boletoNumber?: string | null
  boletoPdfUrl?: string | null
  /** The provider's page with the instructions (and, in Stripe test mode, the button to simulate). */
  hostedUrl?: string | null
  mock?: boolean
}

export function parseInstructions(json: string | null | undefined): PaymentInstructions | null {
  if (!json) return null
  try {
    const v = JSON.parse(json) as PaymentInstructions
    return v && isAsyncMethod(v.method) ? v : null
  } catch { return null }
}

/** The next_action of a Stripe PaymentIntent (pix_display_qr_code / boleto_display_details) → our instructions. */
export function instructionsFromStripe(method: AsyncMethod, amountCents: bigint, nextAction: unknown, fallbackExpires: Date): PaymentInstructions | null {
  const na = (nextAction ?? {}) as { pix_display_qr_code?: Record<string, unknown>; boleto_display_details?: Record<string, unknown> }
  const ts = (n: unknown) => (typeof n === 'number' ? new Date(n * 1000).toISOString() : fallbackExpires.toISOString())
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  if (method === 'PIX') {
    const p = na.pix_display_qr_code
    if (!p || !str(p.data)) return null
    return { method, amountCents: amountCents.toString(), expiresAt: ts(p.expires_at), pixCode: str(p.data), pixQrUrl: str(p.image_url_png), hostedUrl: str(p.hosted_instructions_url) }
  }
  const b = na.boleto_display_details
  if (!b || !str(b.number)) return null
  return { method, amountCents: amountCents.toString(), expiresAt: ts(b.expires_at), boletoNumber: str(b.number), boletoPdfUrl: str(b.pdf), hostedUrl: str(b.hosted_voucher_url) }
}

export interface BoletoBilling { name: string; email: string; taxId: string; line1: string; city: string; state: string; postalCode: string }

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

/** A boleto needs who pays (CPF/CNPJ) and the billing address — what the bank prints on it. */
export function boletoBillingProblem(b: Partial<BoletoBilling>): string | null {
  const digits = (b.taxId ?? '').replace(/\D/g, '')
  if (digits.length !== 11 && digits.length !== 14) return 'Informe o CPF ou CNPJ de quem paga o boleto.'
  if ((b.line1 ?? '').trim().length < 5) return 'Informe o endereço (rua e número) para o boleto.'
  if ((b.city ?? '').trim().length < 2) return 'Informe a cidade.'
  if (!UFS.includes((b.state ?? '').trim().toUpperCase())) return 'Informe a UF (ex.: BA).'
  if ((b.postalCode ?? '').replace(/\D/g, '').length !== 8) return 'Informe o CEP.'
  return null
}

/** Mock Pix "copia e cola": EMV-shaped, deterministic for a deal, clearly not a real key. */
export function mockPixCode(dealCode: string, amountCents: bigint): string {
  const amount = (Number(amountCents) / 100).toFixed(2)
  const field = (id: string, v: string) => `${id}${String(v.length).padStart(2, '0')}${v}`
  const account = field('00', 'br.gov.bcb.pix') + field('01', 'simulacao@houseart.test')
  return field('00', '01') + field('26', account) + field('52', '0000') + field('53', '986') + field('54', amount) + field('58', 'BR') + field('59', 'HOUSEART SIMULACAO') + field('60', 'SALVADOR') + field('62', field('05', dealCode.replace(/[^A-Z0-9]/gi, '').slice(0, 25))) + '6304' + 'SIMU'
}

/** Mock boleto "linha digitável" (47 digits, grouped as the bank prints it), deterministic for a deal. */
export function mockBoletoNumber(dealId: number, amountCents: bigint): string {
  const amount = String(amountCents).padStart(10, '0').slice(-10)
  const id = String(dealId).padStart(10, '0').slice(-10)
  const d = `00190${id}${'0'.repeat(10)}${'1'.repeat(11)}1${amount}`.slice(0, 47).padEnd(47, '0')
  return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d.slice(32, 33)} ${d.slice(33)}`
}

export const METHOD_LABELS: Record<EscrowMethod, { name: string; sub: string; icon: string }> = {
  PIX: { name: 'Pix', sub: 'aprovação na hora', icon: 'qr_code_2' },
  CARD: { name: 'Cartão', sub: 'cartão salvo na carteira', icon: 'credit_card' },
  BOLETO: { name: 'Boleto', sub: '1 dia útil', icon: 'receipt_long' },
}
