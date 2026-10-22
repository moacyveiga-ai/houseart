import { describe, expect, it } from 'vitest'
import { MEDIA_SLOTS } from '@/lib/artworks/domain'
import {
  adjustPixels, artworkCrop, autoAdjust, autoItems, checkChip, clampCrop, compressHighlights, counterOf, cssFilterOf, dragCorner, EMPTY_ADJ,
  exportPlan, frameChecks, isAdjusted, nextRequiredKind, previewFilterOf, progressBars, slotStateOf, summaryOf, toGray,
} from './capture-core'

const front = MEDIA_SLOTS[0], side = MEDIA_SLOTS.find((s) => s.kind === 'SIDE')!

describe('capture core — the grid', () => {
  it('slot states follow the prototype labels', () => {
    expect(slotStateOf(front, undefined, false)).toMatchObject({ label: 'Obrigatória', tone: 'muted', done: false })
    expect(slotStateOf(side, undefined, false)).toMatchObject({ label: 'Opcional', tone: 'muted' })
    expect(slotStateOf(front, { kind: 'FRONT_COLOR_CARD', publicUrl: null, quality: 'GOOD' }, false)).toMatchObject({ label: 'Pronta · toque para refazer', tone: 'ok', cover: true })
    expect(slotStateOf(front, { kind: 'FRONT_COLOR_CARD', publicUrl: null, quality: 'GOOD' }, true)).toMatchObject({ label: 'Ajustada · toque para refazer' })
    expect(slotStateOf(side, { kind: 'SIDE', publicUrl: null, quality: 'BLURRY' }, true)).toMatchObject({ label: 'Desfocada · toque para refazer', tone: 'alert', blurry: true, cover: false })
  })
  it('summary counts required and total', () => {
    expect(summaryOf([]).line).toBe('0 de 6 fotos obrigatórias · 0 de 10 no total')
    const m = [{ kind: 'FRONT_COLOR_CARD', publicUrl: null, quality: null }, { kind: 'SIDE', publicUrl: null, quality: null }]
    expect(summaryOf(m)).toMatchObject({ required: '1 de 6 fotos obrigatórias', total: '2 de 10 no total', complete: false })
    expect(summaryOf(MEDIA_SLOTS.map((s) => ({ kind: s.kind, publicUrl: null, quality: null }))).complete).toBe(true)
  })
  it('counter, next required and bars', () => {
    expect(counterOf('FRONT_COLOR_CARD')).toBe('Foto 1 de 6')
    expect(counterOf('MACRO_BR')).toBe('Foto 6 de 6')
    expect(counterOf('SIGNATURE')).toBe('Foto 7 de 10 · opcional')
    expect(nextRequiredKind([], 'FRONT_COLOR_CARD')).toBe('BACK')
    expect(nextRequiredKind([{ kind: 'BACK', publicUrl: null, quality: null }], 'FRONT_COLOR_CARD')).toBe('MACRO_TL')
    const all = MEDIA_SLOTS.filter((s) => s.required).map((s) => ({ kind: s.kind, publicUrl: null, quality: null }))
    expect(nextRequiredKind(all.slice(1), 'FRONT_COLOR_CARD')).toBeNull()
    expect(progressBars(all.slice(0, 2), 'MACRO_TL')).toEqual(['done', 'done', 'current', 'pending', 'pending', 'pending'])
  })
})

describe('capture core — the editor', () => {
  it('cssFilterOf is the prototype formula', () => {
    expect(cssFilterOf(EMPTY_ADJ)).toBe('brightness(1) contrast(1) saturate(1) sepia(0) hue-rotate(0deg)')
    expect(cssFilterOf({ ...EMPTY_ADJ, bri: 6, con: 10, sat: 4, temp: -4 })).toBe('brightness(1.06) contrast(1.1) saturate(1.04) sepia(0) hue-rotate(-1.6deg)')
    expect(cssFilterOf({ ...EMPTY_ADJ, temp: 20 })).toContain('sepia(0.1) hue-rotate(0deg)')
    expect(cssFilterOf(null)).toBe('none')
    expect(previewFilterOf({ ...EMPTY_ADJ, som: 10 })).toContain('brightness(1.03)')
  })
  it('autoAdjust has the cbAuto values and straightens only the front', () => {
    expect(autoAdjust('FRONT_COLOR_CARD')).toEqual({ auto: true, bri: 6, con: 10, som: 0, sat: 4, temp: -4, rot: -1.5, crop: true, reflex: true })
    expect(autoAdjust('BACK').rot).toBe(0)
    expect(isAdjusted(EMPTY_ADJ)).toBe(false)
    expect(isAdjusted(autoAdjust('BACK'))).toBe(true)
    expect(autoItems(EMPTY_ADJ, 'BACK').map((i) => i.on)).toEqual([false, false, false, false])
    expect(autoItems({ ...EMPTY_ADJ, reflex: true }, 'BACK').map((i) => i.on)).toEqual([false, false, false, true])
    expect(autoItems(autoAdjust('BACK'), 'BACK').map((i) => i.on)).toEqual([true, false, true, true])
    expect(autoItems(autoAdjust('FRONT_COLOR_CARD'), 'FRONT_COLOR_CARD').every((i) => i.on)).toBe(true)
  })
  it('crop: artwork proportion, clamp and corners', () => {
    expect(artworkCrop(1000, 1000, { heightMm: null, widthMm: null })).toEqual({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 })
    const c = artworkCrop(1000, 1000, { heightMm: 1000, widthMm: 500 })
    expect(c.h).toBeCloseTo(0.84); expect(c.w).toBeCloseTo(0.42); expect(c.x).toBeCloseTo(0.29)
    expect(clampCrop({ x: -1, y: 0.9, w: 5, h: 0.05 })).toEqual({ x: 0, y: 0.8, w: 1, h: 0.2 })
    expect(dragCorner({ x: 0, y: 0, w: 1, h: 1 }, 'tl', 0.1, 0.2)).toEqual({ x: 0.1, y: 0.2, w: 0.9, h: 0.8 })
    expect(dragCorner({ x: 0, y: 0, w: 1, h: 1 }, 'br', -0.5, -0.5)).toEqual({ x: 0, y: 0, w: 0.5, h: 0.5 })
    expect(dragCorner({ x: 0, y: 0, w: 1, h: 1 }, 'tl', 0.95, 0).w).toBe(0.2)
  })
  it('exportPlan crops, never upscales and caps at 2048', () => {
    const p = exportPlan({ ...EMPTY_ADJ, rot: 2, reflex: true }, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 8000, 4000)
    expect(p).toMatchObject({ sx: 2000, sy: 1000, sw: 4000, sh: 2000, width: 2048, height: 1024, rotation: 2, reflex: true })
    expect(exportPlan(EMPTY_ADJ, { x: 0, y: 0, w: 1, h: 1 }, 800, 600)).toMatchObject({ width: 800, height: 600, scale: 1 })
  })
})

describe('capture core — the live checks', () => {
  const flat = (v: number, n = 64) => new Uint8Array(n * n).fill(v)
  it('dark, bright and blurry frames', () => {
    expect(frameChecks(flat(20), 64, 64)).toEqual({ light: 'dark', focus: 'blurry' })
    expect(frameChecks(flat(240), 64, 64)).toEqual({ light: 'bright', focus: 'blurry' })
    expect(frameChecks(flat(120), 64, 64)).toEqual({ light: 'ok', focus: 'blurry' })
  })
  it('a sharp checkerboard at mid light is good', () => {
    const w = 64, g = new Uint8Array(w * w)
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) g[y * w + x] = (x + y) % 2 ? 200 : 40
    expect(frameChecks(g, w, w)).toEqual({ light: 'ok', focus: 'ok' })
    expect(checkChip({ light: 'ok', focus: 'ok' })).toEqual({ text: 'Foco e luz bons', ok: true })
    expect(checkChip({ light: 'dark', focus: 'ok' }).text).toBe('Mais luz')
    expect(checkChip({ light: 'ok', focus: 'blurry' }).text).toBe('Aproxime e espere o foco')
    expect(checkChip(null).ok).toBe(false)
  })
  it('toGray weighs the channels', () => {
    expect(Array.from(toGray([255, 0, 0, 255, 0, 255, 0, 255], 2))).toEqual([76, 149])
  })
})

describe('capture core — per-pixel fallbacks', () => {
  it('adjustPixels brightens and clamps', () => {
    const d = new Uint8ClampedArray([100, 100, 100, 255, 250, 250, 250, 255])
    adjustPixels(d, { ...EMPTY_ADJ, bri: 40 })
    expect(d[0]).toBe(140); expect(d[4]).toBe(255); expect(d[3]).toBe(255)
  })
  it('compressHighlights only touches pixels above the threshold', () => {
    const d = new Uint8ClampedArray([255, 255, 255, 255, 100, 100, 100, 255])
    expect(compressHighlights(d)).toBe(1)
    expect(d[0]).toBeLessThan(255); expect(d[0]).toBeGreaterThan(225); expect(d[4]).toBe(100)
  })
})
