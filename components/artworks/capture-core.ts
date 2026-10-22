// Guided capture + photo editor — PURE decisions (tested): the state of each
// slot, the summary line, the CSS filter of the adjustments (the same formula
// as `filtroDe` in the handoff prototype "HouseArt App Colecionador"), the
// automatic improvement (`cbAuto`), the live frame checks over a grayscale
// sample, the crop/rotation plan of the final canvas and the per-pixel
// fallbacks of the export.
import { MEDIA_SLOTS, REQUIRED_MEDIA_SLOTS, type MediaSlot } from '@/lib/artworks/domain'
import { qualityOf } from '@/lib/artworks/media-core'

/** The adjustments of one photo (prototype `adj`): sliders in −40…40, rotation in degrees. */
export interface Adjustments {
  auto: boolean
  /** brightness (Luz) */ bri: number
  /** contrast (Luz) */ con: number
  /** shadows (Luz) — lifts the image by 30 % of its value, like the prototype */ som: number
  /** temperature (Cor): negative = cooler (hue), positive = warmer (sepia) */ temp: number
  /** saturation (Cor) */ sat: number
  /** straighten (Recortar), −10…10° */ rot: number
  /** cropped to the artwork */ crop: boolean
  /** highlight compression applied (Reflexo) */ reflex: boolean
}

export const EMPTY_ADJ: Adjustments = { auto: false, bri: 0, con: 0, som: 0, temp: 0, sat: 0, rot: 0, crop: false, reflex: false }

/** Normalised crop rectangle (0…1 of the rotated frame). */
export interface CropRect { x: number; y: number; w: number; h: number }
export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 }
/** The default crop of "Recortar à obra" without known dimensions (prototype: inset 8 %). */
export const INSET_CROP: CropRect = { x: 0.08, y: 0.08, w: 0.84, h: 0.84 }

export const SLIDERS: Record<'light' | 'color' | 'crop', { key: keyof Adjustments; name: string; min: number; max: number; step: number; unit: string }[]> = {
  light: [
    { key: 'bri', name: 'Brilho', min: -40, max: 40, step: 1, unit: '' },
    { key: 'con', name: 'Contraste', min: -40, max: 40, step: 1, unit: '' },
    { key: 'som', name: 'Sombras', min: -40, max: 40, step: 1, unit: '' },
  ],
  color: [
    { key: 'temp', name: 'Temperatura', min: -40, max: 40, step: 1, unit: '' },
    { key: 'sat', name: 'Saturação', min: -40, max: 40, step: 1, unit: '' },
  ],
  crop: [{ key: 'rot', name: 'Endireitar', min: -10, max: 10, step: 0.5, unit: '°' }],
}

export type EditorTool = 'auto' | 'crop' | 'light' | 'color' | 'reflex'
export const EDITOR_TOOLS: { key: EditorTool; name: string; icon: string }[] = [
  { key: 'auto', name: 'Auto', icon: 'auto_fix_high' },
  { key: 'crop', name: 'Recortar', icon: 'crop_rotate' },
  { key: 'light', name: 'Luz', icon: 'light_mode' },
  { key: 'color', name: 'Cor', icon: 'palette' },
  { key: 'reflex', name: 'Reflexo', icon: 'flare' },
]

export const sliderValueLabel = (v: number, unit: string): string => `${v > 0 ? '+' : ''}${v}${unit}`

export const isAdjusted = (a: Adjustments): boolean =>
  a.auto || a.bri !== 0 || a.con !== 0 || a.som !== 0 || a.temp !== 0 || a.sat !== 0 || a.rot !== 0 || a.crop || a.reflex

// ── the grid (step 1) ──────────────────────────────────────────────────────

export interface SlotMedia { kind: string; publicUrl: string | null; quality: string | null }

export type SlotTone = 'muted' | 'ok' | 'alert'
export interface SlotState { label: string; tone: SlotTone; done: boolean; blurry: boolean; cover: boolean }

/**
 * The status line of a slot card (prototype `cbShots.st`): "Obrigatória" /
 * "Opcional" when empty; "Pronta · toque para refazer" or "Ajustada · toque
 * para refazer" when done; the server's "Desfocada" wins over both.
 */
export function slotStateOf(slot: MediaSlot, media: SlotMedia | undefined, adjusted: boolean): SlotState {
  if (!media) return { label: slot.required ? 'Obrigatória' : 'Opcional', tone: 'muted', done: false, blurry: false, cover: false }
  const cover = slot.kind === 'FRONT_COLOR_CARD'
  if (media.quality === 'BLURRY') return { label: 'Desfocada · toque para refazer', tone: 'alert', done: true, blurry: true, cover }
  return { label: `${adjusted ? 'Ajustada' : 'Pronta'} · toque para refazer`, tone: 'ok', done: true, blurry: false, cover }
}

/** "N de 6 fotos obrigatórias · M no total" (prototype `cbFotosTxt` + `cbFotosPct`). */
export function summaryOf(media: SlotMedia[]): { required: string; total: string; line: string; complete: boolean } {
  const have = REQUIRED_MEDIA_SLOTS.filter((s) => media.some((m) => m.kind === s.kind)).length
  const total = MEDIA_SLOTS.filter((s) => media.some((m) => m.kind === s.kind)).length
  const required = `${have} de ${REQUIRED_MEDIA_SLOTS.length} fotos obrigatórias`
  const totalLine = `${total} de ${MEDIA_SLOTS.length} no total`
  return { required, total: totalLine, line: `${required} · ${totalLine}`, complete: have === REQUIRED_MEDIA_SLOTS.length }
}

/** Capture order: the required slots first, then the optional ones (MEDIA_SLOTS already lists them so). */
export const CAPTURE_ORDER: MediaSlot[] = [...MEDIA_SLOTS.filter((s) => s.required), ...MEDIA_SLOTS.filter((s) => !s.required)]

export const slotIndex = (kind: string): number => CAPTURE_ORDER.findIndex((s) => s.kind === kind)

/** "Foto N de 6" for a required slot; optional ones count on the full list. */
export function counterOf(kind: string): string {
  const slot = CAPTURE_ORDER.find((s) => s.kind === kind)
  if (!slot) return ''
  if (slot.required) return `Foto ${slotIndex(kind) + 1} de ${REQUIRED_MEDIA_SLOTS.length}`
  return `Foto ${slotIndex(kind) + 1} de ${CAPTURE_ORDER.length} · opcional`
}

/** After a capture (prototype `camDisparar`): the next REQUIRED slot still empty, or null (done). */
export function nextRequiredKind(media: SlotMedia[], justDone: string): string | null {
  const have = new Set([...media.map((m) => m.kind), justDone])
  return REQUIRED_MEDIA_SLOTS.find((s) => !have.has(s.kind))?.kind ?? null
}

/** The progress bars of the camera (prototype `cap.tiras`): done · current · pending. */
export function progressBars(media: SlotMedia[], current: string): ('done' | 'current' | 'pending')[] {
  const have = new Set(media.map((m) => m.kind))
  return REQUIRED_MEDIA_SLOTS.map((s) => (s.kind === current ? 'current' : have.has(s.kind) ? 'done' : 'pending'))
}

// ── the editor (step 2) ────────────────────────────────────────────────────

/** The `filtroDe` of the prototype, verbatim. */
export function cssFilterOf(a: Adjustments | null | undefined): string {
  if (!a) return 'none'
  const sepia = Math.max(0, a.temp / 200)
  const hue = Math.min(0, a.temp) * 0.4
  return `brightness(${round(1 + a.bri / 100)}) contrast(${round(1 + a.con / 100)}) saturate(${round(1 + a.sat / 100)}) sepia(${round(sepia)}) hue-rotate(${round(hue)}deg)`
}

/** The filter the editor PREVIEWS: shadows lift brightness by 30 % of their value (prototype `cbEd.filtro`). */
export const previewFilterOf = (a: Adjustments): string => cssFilterOf({ ...a, bri: a.bri + a.som * 0.3 })

const round = (n: number): number => Math.round(n * 1000) / 1000
const r4 = (n: number): number => Math.round(n * 10000) / 10000

/** The values of "Melhorar automaticamente" (prototype `cbAuto`): the front shot is also straightened by −1.5°. */
export function autoAdjust(kind: string, base: Adjustments = EMPTY_ADJ): Adjustments {
  return { ...base, auto: true, bri: 6, con: 10, sat: 4, temp: -4, som: base.som, rot: kind === 'FRONT_COLOR_CARD' ? -1.5 : 0, crop: true, reflex: true }
}

/** The four items under the Auto button (prototype `cbAutoItens`). */
export function autoItems(a: Adjustments, kind: string): { text: string; on: boolean }[] {
  return [
    { text: 'Exposição e contraste equilibrados', on: a.auto },
    { text: 'Cor calibrada pelo cartão de cor', on: a.auto && kind === 'FRONT_COLOR_CARD' },
    { text: 'Obra endireitada e recortada', on: a.auto },
    { text: 'Reflexo de luz removido', on: a.auto || a.reflex },
  ]
}

/** "Recortar à obra": the artwork's proportion centred when the sheet has dimensions, else the 8 % inset. */
export function artworkCrop(frameW: number, frameH: number, dims: { heightMm: number | null; widthMm: number | null }): CropRect {
  if (!dims.heightMm || !dims.widthMm || frameW <= 0 || frameH <= 0) return INSET_CROP
  const target = dims.widthMm / dims.heightMm
  const frame = frameW / frameH
  // 8 % margin around, then fit the artwork's proportion inside
  let w = 0.84, h = 0.84
  if (target > frame) h = (0.84 * frame) / target
  else w = (0.84 * target) / frame
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

/** Keeps a dragged crop inside the frame with a minimum size of 20 %. */
export function clampCrop(c: CropRect): CropRect {
  const MIN = 0.2
  const x = Math.min(Math.max(0, c.x), 1 - MIN)
  const y = Math.min(Math.max(0, c.y), 1 - MIN)
  const w = Math.min(Math.max(MIN, c.w), 1 - x)
  const h = Math.min(Math.max(MIN, c.h), 1 - y)
  return { x: r4(x), y: r4(y), w: r4(w), h: r4(h) }
}

/** Moves one corner of the crop by a normalised delta (prototype: free crop by the corners). */
export function dragCorner(c: CropRect, corner: 'tl' | 'tr' | 'bl' | 'br', dx: number, dy: number): CropRect {
  const r = { x: c.x, y: c.y, w: c.w, h: c.h }
  if (corner === 'tl' || corner === 'bl') { r.x += dx; r.w -= dx } else r.w += dx
  if (corner === 'tl' || corner === 'tr') { r.y += dy; r.h -= dy } else r.h += dy
  if (r.w < 0.2) { if (corner === 'tl' || corner === 'bl') r.x = c.x + c.w - 0.2; r.w = 0.2 }
  if (r.h < 0.2) { if (corner === 'tl' || corner === 'tr') r.y = c.y + c.h - 0.2; r.h = 0.2 }
  return clampCrop(r)
}

export interface ExportPlan {
  /** size of the canvas the final image is drawn on */
  width: number; height: number
  /** source rectangle in the rotated frame, in source pixels */
  sx: number; sy: number; sw: number; sh: number
  /** degrees, applied around the centre of the source */
  rotation: number
  filter: string
  reflex: boolean
  scale: number
}

export const EXPORT_MAX_SIDE = 2048

/**
 * The parameters of the final canvas: the crop of the rotated frame scaled so
 * the longer side is at most `maxSide` (never upscaled). The filter is the
 * preview one (shadows folded into brightness).
 */
export function exportPlan(a: Adjustments, crop: CropRect, srcW: number, srcH: number, maxSide = EXPORT_MAX_SIDE): ExportPlan {
  const c = clampCrop(crop)
  const sx = Math.round(c.x * srcW), sy = Math.round(c.y * srcH)
  const sw = Math.max(1, Math.round(c.w * srcW)), sh = Math.max(1, Math.round(c.h * srcH))
  const scale = Math.min(1, maxSide / Math.max(sw, sh))
  return { width: Math.max(1, Math.round(sw * scale)), height: Math.max(1, Math.round(sh * scale)), sx, sy, sw, sh, rotation: a.rot, filter: previewFilterOf(a), reflex: a.reflex, scale }
}

// ── live checks of the camera ─────────────────────────────────────────────

export interface FrameChecks { light: 'ok' | 'dark' | 'bright'; focus: 'ok' | 'blurry' }

export const DARK_BELOW = 60
export const BRIGHT_ABOVE = 200

/** Mean luminance for exposure, Laplacian variance (the server's `qualityOf`) for focus. */
export function frameChecks(gray: Uint8Array | number[], width: number, height: number): FrameChecks {
  const n = width * height
  let sum = 0
  for (let i = 0; i < n; i++) sum += gray[i]
  const mean = n ? sum / n : 0
  const light = mean < DARK_BELOW ? 'dark' : mean > BRIGHT_ABOVE ? 'bright' : 'ok'
  return { light, focus: qualityOf(gray, width, height) === 'GOOD' ? 'ok' : 'blurry' }
}

/** The chip over the viewfinder: "Foco e luz bons" / "Mais luz" / "Muita luz" / "Aproxime e espere o foco". */
export function checkChip(c: FrameChecks | null): { text: string; ok: boolean } {
  if (!c) return { text: 'Ajustando…', ok: false }
  if (c.light === 'dark') return { text: 'Mais luz', ok: false }
  if (c.light === 'bright') return { text: 'Muita luz · evite o flash', ok: false }
  if (c.focus === 'blurry') return { text: 'Aproxime e espere o foco', ok: false }
  return { text: 'Foco e luz bons', ok: true }
}

/** RGBA → grayscale (Rec. 601), for the sample of the live checks. */
export function toGray(rgba: Uint8ClampedArray | Uint8Array | number[], pixels: number): Uint8Array {
  const out = new Uint8Array(pixels)
  for (let i = 0; i < pixels; i++) out[i] = (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000
  return out
}

// ── per-pixel fallbacks of the export ─────────────────────────────────────

const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v)

/**
 * Brightness · contrast · saturation · temperature applied in place when the
 * canvas has no `ctx.filter` (same order and strength as the CSS filter;
 * the temperature is a warm/cool tint instead of sepia/hue-rotate).
 */
export function adjustPixels(data: Uint8ClampedArray | Uint8Array, a: Adjustments): void {
  const bri = 1 + (a.bri + a.som * 0.3) / 100
  const con = 1 + a.con / 100
  const sat = 1 + a.sat / 100
  const warm = a.temp / 200
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * bri, g = data[i + 1] * bri, b = data[i + 2] * bri
    r = (r - 128) * con + 128; g = (g - 128) * con + 128; b = (b - 128) * con + 128
    const l = r * 0.299 + g * 0.587 + b * 0.114
    r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat
    r += 255 * warm * 0.5; b -= 255 * warm * 0.5
    data[i] = clamp(r); data[i + 1] = clamp(g); data[i + 2] = clamp(b)
  }
}

export const REFLEX_THRESHOLD = 225
export const REFLEX_KEEP = 0.35

/** "Reflexo": pixels above the threshold are pulled back towards it (simple highlight compression). */
export function compressHighlights(data: Uint8ClampedArray | Uint8Array, threshold = REFLEX_THRESHOLD, keep = REFLEX_KEEP): number {
  let touched = 0
  for (let i = 0; i < data.length; i += 4) {
    const l = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    if (l <= threshold) continue
    const target = threshold + (l - threshold) * keep
    const f = target / l
    data[i] = clamp(data[i] * f); data[i + 1] = clamp(data[i + 1] * f); data[i + 2] = clamp(data[i + 2] * f)
    touched++
  }
  return touched
}
