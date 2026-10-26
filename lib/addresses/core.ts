// Endereços de entrega (handoff "Perfil · minha conta") — PURE: the allowlist of UFs, the check of a form,
// the one-line label of an address. The server (server.ts) keeps one default per person.
export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const
export const MAX_ADDRESSES = 10

export interface AddressInput { label: string; recipient: string; cep: string; street: string; number: string; complement: string | null; district: string; city: string; uf: string; isDefault: boolean }
export type AddressCheck = { ok: true; value: AddressInput } | { ok: false; error: string }

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export function checkAddress(raw: Record<string, unknown>): AddressCheck {
  const cep = text(raw.cep, 12).replace(/\D/g, '')
  const uf = text(raw.uf, 2).toUpperCase()
  const v: AddressInput = {
    label: text(raw.label, 40) || 'Casa', recipient: text(raw.recipient, 120), cep, street: text(raw.street, 160), number: text(raw.number, 20),
    complement: text(raw.complement, 80) || null, district: text(raw.district, 80), city: text(raw.city, 80), uf, isDefault: raw.isDefault === true,
  }
  if (!v.recipient) return { ok: false, error: 'Informe quem recebe.' }
  if (cep.length !== 8) return { ok: false, error: 'O CEP tem 8 números.' }
  if (!v.street || !v.number) return { ok: false, error: 'Informe a rua e o número (ou "s/n").' }
  if (!v.district || !v.city) return { ok: false, error: 'Informe o bairro e a cidade.' }
  if (!(UFS as readonly string[]).includes(uf)) return { ok: false, error: 'Escolha o estado.' }
  return { ok: true, value: v }
}

/** "Rua X, 120, ap 31 · Rio Vermelho, Salvador – BA · 41950-000" */
export function addressLine(a: Pick<AddressInput, 'street' | 'number' | 'complement' | 'district' | 'city' | 'uf' | 'cep'>): string {
  const cep = a.cep.length === 8 ? `${a.cep.slice(0, 5)}-${a.cep.slice(5)}` : a.cep
  return `${a.street}, ${a.number}${a.complement ? `, ${a.complement}` : ''} · ${a.district}, ${a.city} – ${a.uf} · ${cep}`
}
