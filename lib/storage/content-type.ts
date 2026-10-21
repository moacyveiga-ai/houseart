// Tipo do arquivo pelos BYTES (ported). Folha pura do
// módulo `lib/storage` (sem importar nada), para que quem precisa decidir o
// tipo — a rota com escopo, o crédito, as telas — não
// feche ciclo de módulos. `lib/private-files/core` o reexporta.

/** Como a tela mostra o arquivo: imagem num `<img>`, PDF num iframe, o resto só por download. */
export type FileKind = 'image' | 'pdf' | 'other'

/** Os tipos que o navegador abre na própria aba (`inline`); o resto sai como download. */
const INLINE = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
/** Os tipos aceitos como "declarados" quando os bytes não dizem nada. */
const SERVIVEIS = new Set([...INLINE, 'image/heic', 'image/heif'])

// marcas `ftyp` do HEIC/HEIF (foto do iPhone)
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs'])
const HEIF_BRANDS = new Set(['mif1', 'msf1'])

/** Onde o formato PDF admite o cabeçalho `%PDF-` (primeiros 1024 bytes). */
const PDF_HEADER_WINDOW = 1024

function hasPdfHeaderWithin(b: Uint8Array, window: number): boolean {
  const end = Math.min(b.length, window) - 4   // cinco bytes a partir de i, dentro da janela
  for (let i = 0; i < end; i++) {
    if (b[i] === 0x25 && b[i + 1] === 0x50 && b[i + 2] === 0x44 && b[i + 3] === 0x46 && b[i + 4] === 0x2d) return true
  }
  return false
}

/**
 * Tipo do que sai: PDF/JPEG/PNG/WEBP/HEIC pelos BYTES (a assinatura do
 * formato); sem assinatura conhecida, o declarado só vale se for um desses;
 * senão `application/octet-stream`. Nunca devolve um tipo executável (HTML,
 * SVG) por mais que o declarado diga.
 */
export function contentTypeOf(bytes: Uint8Array, declared?: string | null): string {
  const b = bytes
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) {
    return 'application/pdf'
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11])
    if (HEIC_BRANDS.has(brand)) return 'image/heic'
    if (HEIF_BRANDS.has(brand)) return 'image/heif'
  }
  // PDF com lixo antes do cabeçalho (BOM, quebra de linha): o formato manda
  // procurar `%PDF-` nos primeiros 1024 bytes. Vem DEPOIS das outras assinaturas
  // para que uma imagem com essa sequência dentro não vire PDF.
  if (hasPdfHeaderWithin(b, PDF_HEADER_WINDOW)) return 'application/pdf'
  const d = declared?.split(';')[0].trim().toLowerCase()
  return d && SERVIVEIS.has(d) ? d : 'application/octet-stream'
}

/** O tipo que a rota devolveu → como a tela o mostra. HEIC e o resto: só download. */
export function fileKindOfContentType(contentType: string): FileKind {
  if (contentType === 'application/pdf') return 'pdf'
  if (contentType === 'image/jpeg' || contentType === 'image/png' || contentType === 'image/webp') return 'image'
  return 'other'
}

/**
 * O que a tela mostra de um arquivo antes de o abrir, sem ler os bytes: pela
 * extensão da referência GUARDADA (o cofre nomeia pelo tipo; o Blob antigo
 * também). Sem extensão conhecida, `other` — a tela oferece download, nunca
 * abre o que não sabe o que é.
 */
export function fileKindOfRef(ref: string | null | undefined): FileKind {
  if (!ref) return 'other'
  const ext = /\.([a-z0-9]{1,5})(?:\?|#|$)/i.exec(ref)?.[1]?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp') return 'image'
  return 'other'
}

/**
 * `inline` só para o que o navegador mostra com segurança (PDF e as três
 * imagens); HEIC e o resto saem como `attachment`, mesmo sem `?download=1`.
 */
export function dispositionFor(contentType: string, download: boolean): 'inline' | 'attachment' {
  return !download && INLINE.has(contentType) ? 'inline' : 'attachment'
}

/**
 * O tipo DECLARADO no upload (`File.type`) é o que os bytes dizem? A extensão
 * que o cofre grava vem do tipo declarado, e a tela decide imagem × PDF por
 * ela: se o conteúdo for outro, o painel mostraria um PDF que a rota serve
 * como download. HEIC e HEIF contam como a mesma família.
 */
export function contentMatchesDeclared(declared: string, bytes: Uint8Array): boolean {
  const d = declared.split(';')[0].trim().toLowerCase()
  const real = contentTypeOf(bytes)
  const familia = (t: string) => (t === 'image/heif' ? 'image/heic' : t)
  return real !== 'application/octet-stream' && familia(real) === familia(d)
}
