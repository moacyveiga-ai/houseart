// The brand, from the files the client supplied (public/brand/*.png, handoff
// 2026-10-21 §4.5). `version` picks the lockup; `tone` picks the colour:
// `auto` = colour on light, negative on ink-900 (follows data-ha-theme).
// Heights come from the application table of the handoff (30 / 44 / 48 / 64…).
import Image from 'next/image'

export type BrandVersion = 'full_horiz' | 'full_vert' | 'full_45_horiz' | 'full_45_vert' | 'simples_horiz' | 'simples_vert'
export type BrandTone = 'auto' | 'color' | 'mono' | 'negativo'

// Intrinsic sizes of the PNGs (width/height), to keep the aspect ratio.
const RATIO: Record<BrandVersion, number> = {
  full_horiz: 539 / 170,
  full_vert: 432 / 170,
  full_45_horiz: 435 / 430,
  full_45_vert: 335 / 367,
  simples_horiz: 535 / 94,
  simples_vert: 351 / 174,
}

const src = (version: BrandVersion, tone: Exclude<BrandTone, 'auto'>) => `/brand/marca_houseart_${version}_${tone}.png`

export function HouseArtLogo({ version = 'full_horiz', tone = 'auto', height = 30 }: { version?: BrandVersion; tone?: BrandTone; height?: number }) {
  const width = Math.round(height * RATIO[version])
  if (tone !== 'auto') {
    return (
      <span className="ha-logo" aria-label="HouseArt">
        <Image src={src(version, tone)} alt="HouseArt" width={width} height={height} priority unoptimized />
      </span>
    )
  }
  return (
    <span className="ha-logo" aria-label="HouseArt">
      <Image src={src(version, 'color')} alt="HouseArt" width={width} height={height} className="ha-logo__light" priority unoptimized />
      <Image src={src(version, 'negativo')} alt="" aria-hidden="true" width={width} height={height} className="ha-logo__dark" priority unoptimized />
    </span>
  )
}

// Sub-brand of language (handoff §4.5): only on the four allowed places.
export type Language = 'pintura' | 'escultura' | 'fotografia' | 'literatura'
export function LanguageMark({ language, tone = 'color', height = 56 }: { language: Language; tone?: Exclude<BrandTone, 'auto'>; height?: number }) {
  const ratio = { pintura: 363 / 321, escultura: 418 / 317, fotografia: 417 / 315, literatura: 413 / 312 }[language]
  return <Image src={`/brand/logo_${language}_${tone}.png`} alt={`HouseArt ${language}`} width={Math.round(height * ratio)} height={height} unoptimized />
}
