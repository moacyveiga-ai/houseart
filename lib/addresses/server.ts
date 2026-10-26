// Endereços de entrega — I/O. Only the owner reads and writes; one default per person (partial unique index,
// switched in the same transaction). The checkout reads the default CEP.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { ArtworkError } from '@/lib/artworks/server'
import { addressLine, checkAddress, MAX_ADDRESSES } from './core'

export interface AddressView { id: number; label: string; recipient: string; line: string; isDefault: boolean; cep: string; street: string; number: string; complement: string | null; district: string; city: string; uf: string }

const view = (a: { id: number; label: string; recipient: string; cep: string; street: string; number: string; complement: string | null; district: string; city: string; uf: string; isDefault: boolean }): AddressView => ({ ...a, line: addressLine(a) })

export async function addressesOf(userId: number): Promise<AddressView[]> {
  const rows = await prisma.shippingAddress.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] })
  return rows.map(view)
}

export async function defaultAddress(userId: number): Promise<AddressView | null> {
  const a = await prisma.shippingAddress.findFirst({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] })
  return a ? view(a) : null
}

export async function saveAddress(userId: number, raw: Record<string, unknown>, id?: number): Promise<AddressView> {
  const chk = checkAddress(raw)
  if (!chk.ok) throw new ArtworkError('BAD_ADDRESS', chk.error, 422)
  return prisma.$transaction(async (tx) => {
    const current = id != null ? await tx.shippingAddress.findFirst({ where: { id, userId } }) : null
    if (id != null && !current) throw new ArtworkError('NOT_FOUND', 'Endereço não encontrado.', 404)
    const count = await tx.shippingAddress.count({ where: { userId } })
    if (!current && count >= MAX_ADDRESSES) throw new ArtworkError('TOO_MANY', `Até ${MAX_ADDRESSES} endereços.`, 409)
    // the first address is the default; the default stays until another one takes it (never zero defaults)
    const isDefault = chk.value.isDefault || count === 0 || !!current?.isDefault
    // a new default unsets the old one first (one default per person: partial unique index)
    if (isDefault) await tx.shippingAddress.updateMany({ where: { userId, isDefault: true, ...(current ? { id: { not: current.id } } : {}) }, data: { isDefault: false } })
    const data = { ...chk.value, isDefault }
    const row = current ? await tx.shippingAddress.update({ where: { id: current.id }, data }) : await tx.shippingAddress.create({ data: { ...data, userId } })
    return view(row)
  })
}

export async function deleteAddress(userId: number, id: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const a = await tx.shippingAddress.findFirst({ where: { id, userId } })
    if (!a) throw new ArtworkError('NOT_FOUND', 'Endereço não encontrado.', 404)
    await tx.shippingAddress.delete({ where: { id } })
    // the default left: the oldest one takes its place
    if (a.isDefault) {
      const next = await tx.shippingAddress.findFirst({ where: { userId }, orderBy: { id: 'asc' } })
      if (next) await tx.shippingAddress.update({ where: { id: next.id }, data: { isDefault: true } })
    }
  })
}
