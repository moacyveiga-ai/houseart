// The brand, from the files the client supplied (public/brand/*.png, new pack of 2026-11-04):
// ONE lockup — the upright four-module symbol beside "houseArt" — in colour or mono, on light
// (positivo) or on dark (negativo). `tone` picks the file:
//   color = colour on light · mono = graphite on light · negativo = colour on dark ·
//   mono-negativo = white on dark · auto = colour, negative on ink-900 (follows data-ha-theme) ·
//   auto-mono = graphite, white on dark (the wordmark of the apps).
// `version` is the lockup of the old pack (2026-10-21). The new pack has a single horizontal
// lockup, so every version draws it; the version only keeps the footprint each screen was laid
// out for (the same width as the old file at that height; the old text-only lockups get the same
// letter height instead), so no call site had to change.
import Image from 'next/image'

export type BrandVersion = 'full_horiz' | 'full_vert' | 'full_45_horiz' | 'full_45_vert' | 'simples_horiz' | 'simples_vert'
export type BrandTone = 'auto' | 'auto-mono' | 'color' | 'mono' | 'negativo' | 'mono-negativo'

/** Intrinsic width/height of the new lockup (marca_houseart_*.png). */
export const BRAND_RATIO = 773 / 149

// Height of the new lockup per old version, as a factor of the height the screen asks for.
const SCALE: Record<BrandVersion, number> = {
  full_horiz: (539 / 170) / BRAND_RATIO,
  full_vert: (432 / 170) / BRAND_RATIO,
  full_45_horiz: (435 / 430) / BRAND_RATIO,
  full_45_vert: (335 / 367) / BRAND_RATIO,
  simples_horiz: 1.3,
  simples_vert: 1.2,
}

type FileTone = Exclude<BrandTone, 'auto' | 'auto-mono'>
const FILE: Record<FileTone, string> = { color: 'color_positivo', mono: 'mono_positivo', negativo: 'color_negativo', 'mono-negativo': 'mono_negativo' }
export const brandSrc = (tone: FileTone) => `/brand/marca_houseart_${FILE[tone]}.png`

export function HouseArtLogo({ version = 'full_horiz', tone = 'auto', height = 30 }: { version?: BrandVersion; tone?: BrandTone; height?: number }) {
  const h = Math.max(14, Math.round(height * SCALE[version]))
  const width = Math.round(h * BRAND_RATIO)
  if (tone !== 'auto' && tone !== 'auto-mono') {
    return (
      <span className="ha-logo" aria-label="HouseArt">
        <Image src={brandSrc(tone)} alt="HouseArt" width={width} height={h} priority unoptimized />
      </span>
    )
  }
  const mono = tone === 'auto-mono'
  return (
    <span className="ha-logo" aria-label="HouseArt">
      <Image src={brandSrc(mono ? 'mono' : 'color')} alt="HouseArt" width={width} height={h} className="ha-logo__light" priority unoptimized />
      <Image src={brandSrc(mono ? 'mono-negativo' : 'negativo')} alt="" aria-hidden="true" width={width} height={h} className="ha-logo__dark" priority unoptimized />
    </span>
  )
}

// Seal of language (selo): each module of the symbol is a language — pintura, fotografia,
// escultura and design (new pack of 2026-11-04; design took the purple module of literatura).
export const LANGUAGES = ['pintura', 'escultura', 'fotografia', 'design'] as const
export type Language = (typeof LANGUAGES)[number]
const SEAL_RATIO: Record<Language, number> = { pintura: 363 / 507, fotografia: 503 / 509, escultura: 491 / 484, design: 356 / 506 }
const SEAL_FILE: Record<Exclude<BrandTone, 'auto' | 'auto-mono' | 'mono-negativo'>, string> = { color: 'positivo', mono: 'mono', negativo: 'negativo' }
export function LanguageMark({ language, tone = 'color', height = 56 }: { language: Language; tone?: 'color' | 'mono' | 'negativo'; height?: number }) {
  return <Image src={`/brand/selo_${language}_${SEAL_FILE[tone]}.png`} alt={`HouseArt ${language}`} width={Math.round(height * SEAL_RATIO[language])} height={height} unoptimized />
}
