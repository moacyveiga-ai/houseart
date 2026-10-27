// Canvas drawing of the capture + editor (browser only; no React, no I/O
// beyond the canvas). The decisions live in capture-core.ts.
import { adjustPixels, compressHighlights, exportPlan, type Adjustments, type CropRect } from './capture-core'

export type Source = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap

export function sourceSize(src: Source): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight }
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight }
  return { w: src.width, h: src.height }
}

const hasFilter = (ctx: CanvasRenderingContext2D): boolean => 'filter' in ctx

/**
 * Draws the source with rotation (around its centre), crop and the
 * adjustments onto `canvas`, scaled so the longer side is ≤ `maxSide`.
 * `original` ignores every adjustment (the "Ver original" of the prototype).
 */
export function renderFrame(canvas: HTMLCanvasElement, src: Source, adj: Adjustments, crop: CropRect, opts: { maxSide: number; original?: boolean }): void {
  const { w: srcW, h: srcH } = sourceSize(src)
  if (!srcW || !srcH) return
  const a = opts.original ? { ...adj, bri: 0, con: 0, som: 0, temp: 0, sat: 0, rot: 0, reflex: false } : adj
  const c = opts.original ? { x: 0, y: 0, w: 1, h: 1 } : crop
  const plan = exportPlan(a, c, srcW, srcH, opts.maxSide)
  canvas.width = plan.width; canvas.height = plan.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  ctx.save()
  const useFilter = hasFilter(ctx)
  if (useFilter) ctx.filter = plan.filter
  // the crop is a window over the rotated frame: translate so the window's
  // origin sits at 0,0, then rotate the source about its own centre
  ctx.scale(plan.scale, plan.scale)
  ctx.translate(-plan.sx, -plan.sy)
  ctx.translate(srcW / 2, srcH / 2)
  ctx.rotate((plan.rotation * Math.PI) / 180)
  ctx.drawImage(src, -srcW / 2, -srcH / 2, srcW, srcH)
  ctx.restore()
  if (!useFilter || plan.reflex) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    if (!useFilter) adjustPixels(img.data, a)
    if (plan.reflex) compressHighlights(img.data)
    ctx.putImageData(img, 0, 0)
  }
}

/** JPEG of the canvas (quality .92, the derivative is recomputed by the server anyway). */
export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality)
  })
}

/** Loads a File/Blob into a decoded <img>; the caller revokes the URL. */
export function loadImage(blob: Blob): Promise<{ img: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir a imagem.')) }
    img.src = url
  })
}

/** The still of the viewfinder: the current video frame in JPEG with the longer side ≤ 2048. */
export async function snapshotVideo(video: HTMLVideoElement, maxSide: number): Promise<Blob> {
  const w = video.videoWidth, h = video.videoHeight
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale)
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvasToJpeg(canvas)
}

/** A small grayscale sample of the video for the live checks. */
export function sampleGray(video: HTMLVideoElement, scratch: HTMLCanvasElement, side: number): { data: Uint8ClampedArray; w: number; h: number } | null {
  if (!video.videoWidth || !video.videoHeight) return null
  scratch.width = side; scratch.height = side
  const ctx = scratch.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, side, side)
  return { data: ctx.getImageData(0, 0, side, side).data, w: side, h: side }
}

/** A photo picked from the device, reduced in the browser (≤ maxSide, JPEG) before upload: keeps the body under the function limit. */
export async function shrinkToJpeg(file: Blob, maxSide = 2048, quality = 0.86): Promise<Blob> {
  const { img, url } = await loadImage(file)
  try {
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k)); canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await canvasToJpeg(canvas, quality)
  } finally { URL.revokeObjectURL(url) }
}
