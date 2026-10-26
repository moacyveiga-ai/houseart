// The PATCH body of the wizard (autosave): validated with zod, cm → mm. Pure.
import { z } from 'zod'
import { ORIGIN_KINDS, ARTWORK_CATEGORIES, CONDITION_GRADES, CONDITION_REGIONS, CONDITION_STATES, HISTORY_KINDS, SALE_MODES } from './domain'

const cmToMm = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 10)
}
const text = (max: number) => z.string().trim().max(max).nullable().optional()
const intOrNull = z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().int().min(1000).max(2100).nullable()).optional()
const mm = z.preprocess(cmToMm, z.number().int().max(100_000).nullable()).optional()
const cents = z.preprocess((v) => {
  if (v === '' || v === null || v === undefined) return null
  if (typeof v === 'number') return Math.round(v)
  const digits = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(digits)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}, z.number().int().min(0).max(10_000_000_000).nullable()).optional()

export const artworkPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  year: intOrNull,
  technique: text(120),
  materials: text(500),
  heightMm: mm,
  widthMm: mm,
  depthMm: mm,
  edition: text(80),
  signatureLocation: text(120),
  series: text(120),
  category: z.enum(ARTWORK_CATEGORIES).optional(),
  acquisitionKind: z.enum(ORIGIN_KINDS).nullable().optional(),
  acquisitionYear: intOrNull,
  acquisitionFrom: text(160),
  acquisitionNote: text(500),
  acquisitionPriceCents: z.union([z.string().regex(/^\d{1,15}$/), z.number().int().nonnegative()]).transform((v) => BigInt(v)).nullable().optional(),
  conditionGrade: z.enum(CONDITION_GRADES).nullable().optional(),
  conditionRegions: z.array(z.object({ region: z.enum(CONDITION_REGIONS), note: z.string().trim().max(300).default(''), state: z.enum(CONDITION_STATES) })).max(5).optional(),
  historyItems: z.array(z.object({ kind: z.enum(HISTORY_KINDS), description: z.string().trim().min(1).max(300), occurredOn: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })).max(50).optional(),
  saleMode: z.enum(SALE_MODES).nullable().optional(),
  listPriceCents: cents,
  wizardStep: z.number().int().min(0).max(5).optional(),
}).strict()

export type ArtworkPatch = z.infer<typeof artworkPatchSchema>
