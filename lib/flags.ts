// Feature flags — the ONLY reader (ported from the Housebroker, QA 2026-10
// section 6). A flag is ON when the env value is exactly '1', except the
// `defaultOn` ones, which are born ON and the env can only switch OFF.
// Ratchet: lib/architecture/flags.test.ts (no flag read outside this file;
// every flag documented in .env.example).

export type Env = Record<string, string | undefined>

interface FlagSpec {
  /** what the flag turns on, in one line */
  what: string
  /** values that turn it on (default: only '1') */
  on?: readonly string[]
  /** trims the ends before comparing */
  trim?: boolean
  /** ON without env (or empty); with env, anything outside `ON_VALUES` turns OFF */
  defaultOn?: true
}

export const FLAGS = {
  // ── product ─────────────────────────────────────────────────────────────
  FLAG_TENANT_SCOPE: { what: 'Tenant level of the data scope (gallery admin sees the whole gallery); born ON, `0` turns off', defaultOn: true },
  FLAG_MEMBER_APP: { what: 'Mobile shell of the member app (artist/gallery)' },
  FLAG_COLLECTOR_APP: { what: 'Mobile shell of the collector app' },
  FLAG_CONSIGNMENT_REQUIRED: { what: 'Listing a consigned artwork requires an ACCEPTED consignment agreement' },
  FLAG_DEALS: { what: 'Accepted offer becomes a Deal with phases (escrow → delivery → transfer)' },
  // ── authentication of the artwork ───────────────────────────────────────
  FLAG_PHYSICAL_MARKERS: { what: 'NFC markers: batches, kit orders, linking by SUN read' },
  FLAG_CERTIFICATES: { what: 'Certificate-deed: sign, issue, versions, public verification' },
  FLAG_OWNERSHIP_TRANSFER: { what: 'Ownership transfer (on-platform and off-platform) with new certificate version' },
  FLAG_KYC_REQUIRED: { what: 'Buyer KYC required before accepting an assignment' },
  FLAG_RESALE_ROYALTY: { what: 'Resale royalty (5% of appreciation) withheld in the split and paid to the artist' },
  FLAG_DUPLICATE_DETECTION: { what: 'Perceptual-hash duplicate check on artwork registration' },
  FLAG_DOCUMENT_READING: { what: 'AI reading of prior certificates and gallery invoices on upload (paid call)' },
  FLAG_PROVENANCE_REPORT: { what: 'Provenance dossier: draft, review, issue, deliver' },
  FLAG_PROVENANCE_CHECKS_AUTO: { what: 'Cron that runs paid provenance checks automatically', on: ['true'] },
  FLAG_PROVENANCE_CONSENT_REQUIRED: { what: 'Provenance checks only with registered consent', on: ['on'] },
  // ── money ───────────────────────────────────────────────────────────────
  FLAG_ORDERS: { what: 'Service catalog and orders (certification, appraisal, markers…) charged by Stripe' },
  FLAG_PLANS: { what: 'Plans (Artist Free/Studio, Gallery/Gallery Pro, Advisor); requires FLAG_ORDERS' },
  FLAG_COMMISSION: { what: 'Commission born on offer acceptance, split by party' },
  FLAG_BILLING: { what: 'Stripe billing, Connect and the ledger' },
  FLAG_ESCROW: { what: 'Escrow: payment held at the platform until the transfer completes' },
  FLAG_CARD_INSTALLMENTS: { what: 'Card installments (3×/6×/10×, no interest) at direct buy; off until checked in Stripe test mode with a Brazilian card' },
  FLAG_LOGISTICS: { what: 'Shipping and transit insurance inside the checkout' },
  FLAG_APPRAISAL: { what: 'Appraisal queue and signed valuation report' },
  // ── channels / integrations ─────────────────────────────────────────────
  FLAG_WHATSAPP_EVOLUTION: { what: 'WhatsApp Web per person (QR code)' },
  FLAG_WHATSAPP_BUSINESS_SIGNUP: { what: 'WhatsApp Business per person (Embedded Signup)' },
  FLAG_META_PER_MEMBER: { what: 'Instagram and Meta Ads per member' },
  FLAG_PUBLIC_API: { what: 'Public API v1 (certificate lookup, gallery webhooks, inventory import)' },
  // ── RBAC ────────────────────────────────────────────────────────────────
  FLAG_RBAC_SHADOW: { what: 'RBAC in shadow: loads roles, compares with the profile rule, logs divergence' },
  FLAG_RBAC: { what: 'RBAC decides (requirePermission and the profile predicates)' },
  FLAG_RBAC_SOURCE_ROLES: { what: 'UserRole is the source and profile the mirror; only with FLAG_RBAC' },
  FLAG_FEDERATED_PROVISIONING: { what: 'Creates User/Tenant on first federated login (House group)', trim: true },
} as const satisfies Record<string, FlagSpec>

export type FlagName = keyof typeof FLAGS

/** What keeps a `defaultOn` flag ON when the env exists; any other non-empty value turns it OFF. */
const ON_VALUES = ['1', 'true', 'on']

/** Is the flag on? Exactly '1' (or the declared `on` values); a `defaultOn`, unless turned off. */
export function flagOn(name: FlagName, env: object = process.env): boolean {
  const spec: FlagSpec = FLAGS[name]
  const raw = (env as Env)[name] ?? ''
  if (spec.defaultOn) {
    const v = raw.trim().replace(/^["'“”]+|["'“”]+$/g, '').trim().toLowerCase()
    return v === '' || ON_VALUES.includes(v)
  }
  return (spec.on ?? ['1']).includes(spec.trim ? raw.trim() : raw)
}
