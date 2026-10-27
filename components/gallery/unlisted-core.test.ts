import { describe, expect, it } from 'vitest'
import { unlistedState } from './unlisted-core'

const all = { manage: true, edit: true }
const art = (status: string, seal = 'GREEN', publicId: string | null = null) => ({ id: 7, status, seal, publicId })

describe('unlistedState', () => {
  it('offers selling only for an authenticated artwork with the green seal, to whoever may list', () => {
    expect(unlistedState(art('AUTHENTICATED'), all).action).toEqual({ kind: 'sell' })
    expect(unlistedState(art('AUTHENTICATED'), { manage: false, edit: true }).action).toBeNull()
    expect(unlistedState(art('AUTHENTICATED', 'YELLOW'), all).action).toBeNull()
  })
  it('points certification to the next step', () => {
    expect(unlistedState(art('IN_CERTIFICATION'), all).action).toMatchObject({ href: '/certification/link/7' })
    expect(unlistedState(art('IN_CERTIFICATION', 'YELLOW', 'HA-1'), all).action).toMatchObject({ href: '/certification' })
    expect(unlistedState(art('DRAFT'), all).action).toMatchObject({ href: '/artworks/7/edit' })
    expect(unlistedState(art('DRAFT'), { manage: false, edit: false }).action).toBeNull()
  })
  it('sends a reserved artwork to the sale and leaves closed cases without action', () => {
    expect(unlistedState(art('IN_DEAL'), { manage: false, edit: false }).action).toMatchObject({ href: '/sales?tab=deals' })
    expect(unlistedState(art('STOLEN'), all).action).toBeNull()
    expect(unlistedState(art('SOLD'), all).action).toBeNull()
  })
})
