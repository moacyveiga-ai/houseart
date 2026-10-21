// Perceptual hash (dHash 8×9 → 64 bits) over grayscale pixels, and the
// Hamming similarity in bps. Pure: the pixels come from sharp (server).
export function dHash(gray: Uint8Array | number[], width = 9, height = 8): string {
  if (gray.length < width * height) throw new Error('dHash: pixels insuficientes')
  let bits = ''
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const left = gray[y * width + x]
      const right = gray[y * width + x + 1]
      bits += left > right ? '1' : '0'
    }
  }
  return BigInt('0b' + bits).toString(16).padStart(16, '0')
}

export function hammingDistance(a: string, b: string): number {
  let x = BigInt('0x' + a) ^ BigInt('0x' + b)
  let d = 0
  while (x) { d += Number(x & 1n); x >>= 1n }
  return d
}

/** 10000 = identical; each differing bit of 64 removes 1/64. */
export function similarityBps(a: string, b: string): number {
  return Math.round((1 - hammingDistance(a, b) / 64) * 10000)
}

/** Threshold of the admin queue ("Imagem 91% semelhante"). */
export const DUPLICATE_THRESHOLD_BPS = 8500
