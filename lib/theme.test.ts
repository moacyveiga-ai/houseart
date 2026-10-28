import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ALWAYS_LIGHT_ROUTES, DEFAULT_THEME, antiFlashScript, isAlwaysLightRoute as rotaSempreClara } from './theme-routes'

// Ratchet (revisão adversarial 9.7): as rotas sempre claras viviam em TRÊS
// listas editadas à mão — rotaSempreClara, o script anti-flash do root layout
// e STANDALONE_PREFIXES/EXATAS do AppShell. As duas primeiras agora saem de
// ALWAYS_LIGHT_ROUTES; a terceira é conferida aqui pela fonte.
describe('rotas sempre claras', () => {
  it('rotaSempreClara casa a rota e os filhos, e nada parecido', () => {
    for (const r of ALWAYS_LIGHT_ROUTES) {
      expect(rotaSempreClara(r), r).toBe(true)
      expect(rotaSempreClara(`${r}/x`), `${r}/x`).toBe(true)
    }
    expect(rotaSempreClara('/artworks')).toBe(false)
    expect(rotaSempreClara('/export')).toBe(false)
    expect(rotaSempreClara('/verification')).toBe(false)
  })

  it('o módulo das rotas é puro (sem use client) e é dele que o root layout importa', () => {
    // lib/theme.ts é 'use client'; chamar uma função dele no Server Component
    // derruba toda página. O layout só pode importar de theme-routes.
    // a diretiva só vale no topo do arquivo (antes de qualquer código); o
    // cabeçalho de comentário cita a frase de propósito
    const semComentarios = readFileSync('lib/theme-routes.ts', 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')
    expect(semComentarios).not.toContain('use client')
    const layout = readFileSync('app/layout.tsx', 'utf8')
    expect(layout).toContain("from '@/lib/theme-routes'")
    expect(layout).not.toMatch(/from '@\/lib\/theme'/)
  })

  it('o script anti-flash carrega a mesma lista', () => {
    const js = antiFlashScript()
    expect(js).toContain(JSON.stringify(ALWAYS_LIGHT_ROUTES))
    expect(js).toContain("data-ha-theme")
    expect(js.startsWith('(function(){')).toBe(true)
  })

  it('sem preferência gravada o painel é claro (o escuro não foi desenhado)', () => {
    expect(DEFAULT_THEME).toBe('light')
    expect(antiFlashScript()).toContain("t='light'")
  })

})

describe('temas escolhidos no Perfil', () => {
  it('cada tema vira o atributo do <html>', async () => {
    const { themeAttr, isTheme } = await import('./theme-routes')
    expect(themeAttr('light', true)).toBe('')
    expect(themeAttr('pastel', true)).toBe('pastel')
    expect(themeAttr('dark', false)).toBe('dark')
    expect(themeAttr('system', true)).toBe('dark')
    expect(themeAttr('system', false)).toBe('')
    expect(isTheme('pastel')).toBe(true)
    expect(isTheme('neon')).toBe(false)
  })

  it('os tokens têm os dois temas', () => {
    const css = readFileSync('app/ds/tokens.css', 'utf8')
    expect(css).toContain('[data-ha-theme="dark"]')
    expect(css).toContain('[data-ha-theme="pastel"]')
  })
})
