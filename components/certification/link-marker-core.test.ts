import { describe, expect, it } from 'vitest'
import { initialLinkState, linkErrorMessage, linkReducer, linkTexts, parsePastedMarker, parseSunUrl } from './link-marker-core'

const UID = '04a1b2c3d4e5f6'
const CMAC = '0123456789abcdef'

describe('parseSunUrl', () => {
  it('reads uid, ctr and cmac from the full URL of the tag', () => {
    expect(parseSunUrl(`https://houseart.example/a/HA-2026-D4F2-9QDM?uid=${UID.toUpperCase()}&ctr=42&cmac=${CMAC.toUpperCase()}`)).toEqual({ uid: UID, ctr: 42, cmac: CMAC })
  })
  it('accepts a bare query', () => {
    expect(parseSunUrl(`?uid=${UID}&ctr=7&cmac=${CMAC}`)).toEqual({ uid: UID, ctr: 7, cmac: CMAC })
    expect(parseSunUrl(`uid=${UID}&ctr=7&cmac=${CMAC}`)).toEqual({ uid: UID, ctr: 7, cmac: CMAC })
  })
  it('rejects missing or malformed fields', () => {
    expect(parseSunUrl('')).toBeNull()
    expect(parseSunUrl(`https://x/a?uid=${UID}&ctr=7`)).toBeNull()
    expect(parseSunUrl(`https://x/a?uid=zz&ctr=7&cmac=${CMAC}`)).toBeNull()
    expect(parseSunUrl(`https://x/a?uid=${UID}&ctr=-1&cmac=${CMAC}`)).toBeNull()
    expect(parseSunUrl(`https://x/a?uid=${UID}&ctr=99999999&cmac=${CMAC}`)).toBeNull()
    expect(parseSunUrl('https://x/a')).toBeNull()
  })
})

describe('parsePastedMarker', () => {
  it('full read → sun; bare uid → uid; garbage → null', () => {
    expect(parsePastedMarker(`https://x/a?uid=${UID}&ctr=1&cmac=${CMAC}`)).toEqual({ kind: 'sun', read: { uid: UID, ctr: 1, cmac: CMAC } })
    expect(parsePastedMarker(' 04:A1:B2:C3:D4:E5:F6 ')).toEqual({ kind: 'uid', uid: UID })
    expect(parsePastedMarker('HA-2026-D4F2-9QDM')).toBeNull()
  })
})

describe('link state machine', () => {
  it('reading → linked → signing → signed', () => {
    let s = initialLinkState()
    expect(s.phase).toBe('reading')
    s = linkReducer(s, { type: 'LINKED', publicId: 'HA-2026-D4F2-9QDM' })
    expect(s).toEqual({ phase: 'linked', publicId: 'HA-2026-D4F2-9QDM', error: null })
    s = linkReducer(s, { type: 'SIGN_START' })
    expect(s.phase).toBe('signing')
    s = linkReducer(s, { type: 'SIGNED' })
    expect(s.phase).toBe('signed')
  })
  it('error and retry; a failed signature goes back to linked with the message', () => {
    let s = linkReducer(initialLinkState(), { type: 'FAILED', message: 'Etiqueta desconhecida.' })
    expect(s).toMatchObject({ phase: 'error', error: 'Etiqueta desconhecida.' })
    s = linkReducer(s, { type: 'RETRY' })
    expect(s.phase).toBe('reading')
    s = linkReducer(linkReducer(initialLinkState('HA-1'), { type: 'SIGN_START' }), { type: 'SIGN_FAILED', message: 'x' })
    expect(s).toMatchObject({ phase: 'linked', error: 'x' })
  })
  it('ignores events out of phase', () => {
    const linked = initialLinkState('HA-1')
    expect(linkReducer(linked, { type: 'FAILED', message: 'x' })).toBe(linked)
    expect(linkReducer(linked, { type: 'SIGNED' })).toBe(linked)
  })
  it('an already linked artwork starts at linked', () => {
    expect(initialLinkState('HA-1').phase).toBe('linked')
  })
})

describe('linkTexts', () => {
  it('follows LT.vincular of the prototype', () => {
    expect(linkTexts(initialLinkState(), 'Maré de março')).toEqual({ top: 'Vincular etiqueta', title: 'Encoste o celular no verso da obra', text: 'Bem no centro da etiqueta, até vibrar', cta: null })
    expect(linkTexts(initialLinkState('HA-2026-D4F2-9QDM'), 'Maré de março')).toMatchObject({ title: 'Etiqueta vinculada', text: 'Maré de março · HA-2026-D4F2-9QDM', cta: 'Assinar certificado digitalmente' })
    expect(linkTexts({ phase: 'signed', publicId: 'HA-1', error: null }, 'x')).toMatchObject({ title: 'Certificado assinado', cta: 'Voltar à certificação' })
  })
})

describe('linkErrorMessage', () => {
  it('uses the route text and does not invent a cause', () => {
    expect(linkErrorMessage(409, { error: 'A obra já tem etiqueta.' })).toBe('A obra já tem etiqueta.')
    expect(linkErrorMessage(400, {})).toBe('Leitura inválida. Tente de novo.')
    expect(linkErrorMessage(0, null)).toBe('Sem conexão. Tente de novo.')
  })
})
