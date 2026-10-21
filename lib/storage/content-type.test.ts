// Auditoria 2026-10-12, correção final do Lote 3 (F5): o tipo pelos bytes
// aceita o cabeçalho `%PDF-` nos primeiros 1024 bytes (a regra do próprio
// formato), sem trocar o tipo de quem tem outra assinatura logo no início.
import { describe, expect, it } from 'vitest'
import { contentTypeOf } from './content-type'

const pdf = (prefix: Uint8Array = new Uint8Array()) =>
  new Uint8Array([...prefix, ...Buffer.from('%PDF-1.7\n1 0 obj\n')])

describe('contentTypeOf — PDF com bytes antes do cabeçalho', () => {
  it('PDF puro continua sendo PDF', () => {
    expect(contentTypeOf(pdf())).toBe('application/pdf')
  })

  it('BOM UTF-8 ou quebra de linha antes de %PDF- ainda é PDF', () => {
    expect(contentTypeOf(pdf(new Uint8Array([0xef, 0xbb, 0xbf])))).toBe('application/pdf')
    expect(contentTypeOf(pdf(Buffer.from('\r\n')))).toBe('application/pdf')
  })

  it('o cabeçalho que cabe nos 1024 primeiros bytes vale; o que começa depois, não', () => {
    expect(contentTypeOf(pdf(new Uint8Array(1019).fill(0x20)))).toBe('application/pdf')   // %PDF- ocupa 1019..1023
    expect(contentTypeOf(pdf(new Uint8Array(1020).fill(0x20)))).toBe('application/octet-stream')
  })

  it('imagem com %PDF- escondido dentro continua sendo imagem', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from(' %PDF-1.4 ')])
    expect(contentTypeOf(jpeg)).toBe('image/jpeg')
  })

  it('sem o cabeçalho, só o declarado servível vale', () => {
    expect(contentTypeOf(Buffer.from('<html>oi</html>'), 'application/pdf')).toBe('application/pdf')
    expect(contentTypeOf(Buffer.from('<html>oi</html>'), 'text/html')).toBe('application/octet-stream')
  })
})
