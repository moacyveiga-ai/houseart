'use client'

import { isAlwaysLightRoute } from './theme-routes'
// ════════════════════════════════════════════════════════════════════════════
//  Tema por usuário — Claro / Escuro / Sistema, salvo em localStorage.
//  Aplica-se ao backoffice logado (tudo que consome --hm-*). O atributo vai no
//  <html>: data-ha-theme="dark" = escuro; ausência/"" = Light Concrete padrão.
//  O marketplace público /e é SEMPRE claro (é desenhado sobre fundo claro, e
//  os componentes dele também leem --hm-*: com o tema escuro do painel, o
//  texto e o logo ficavam claros sobre claro). Quem garante é o script
//  anti-flash (pula /e) e o TemaClaroFixo do layout de /e (navegação
//  client-side vinda do painel).
//  O script anti-flash em app/layout.tsx replica applyTheme() antes da pintura.
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'

export const THEME_KEY = 'ha-theme'
import { DEFAULT_THEME } from './theme-routes'

const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark' || v === 'system'

/** Lê a preferência salva; default 'light' (auditoria DS 2026-10-25: o escuro do painel não foi desenhado e não há seletor na tela — só uma preferência gravada o liga). Seguro no server (retorna default). */
export function getTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const v = window.localStorage.getItem(THEME_KEY)
    return isTheme(v) ? v : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/** Resolve 'system' pela media query do SO → 'light' | 'dark'. */
export function resolveTheme(t: Theme): 'light' | 'dark' {
  if (t === 'system') {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return t
}

/**
 * Rotas que ignoram o tema do usuário e ficam no claro: o portal público /e e
 * a área do cliente /conta (páginas com fundo claro por classe fixa; desde a
 * Fase 9.1 a barra do App do Cliente usa tokens --hm-* e ficaria escura sobre
 * página clara se o tema do SO fosse escuro).
 */
export { ALWAYS_LIGHT_ROUTES, antiFlashScript } from './theme-routes'

/** Rota sempre clara (portal, área do cliente, landing, convite) — lista em lib/theme-routes.ts. */
export function rotaSempreClara(pathname: string): boolean {
  return isAlwaysLightRoute(pathname)
}

/** Aplica no <html>: 'dark' → data-ha-theme="dark"; caso contrário limpa (claro). */
export function applyTheme(t: Theme): void {
  if (typeof document === 'undefined') return
  const resolvido = rotaSempreClara(window.location.pathname) ? 'light' : resolveTheme(t)
  document.documentElement.setAttribute('data-ha-theme', resolvido === 'dark' ? 'dark' : '')
}

// Assinantes do tema para useSyncExternalStore. O evento nativo 'storage' só
// dispara entre abas, então setTheme() notifica manualmente os listeners da aba.
const themeListeners = new Set<() => void>()

function subscribeTheme(cb: () => void): () => void {
  themeListeners.add(cb)
  if (typeof window !== 'undefined') window.addEventListener('storage', cb)
  return () => {
    themeListeners.delete(cb)
    if (typeof window !== 'undefined') window.removeEventListener('storage', cb)
  }
}

/** Grava a preferência e aplica imediatamente. */
export function setTheme(t: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, t)
  } catch {
    /* ignora quota/privacidade */
  }
  applyTheme(t)
  themeListeners.forEach(l => l())
}

/**
 * Hook de tema: retorna [theme, setTheme]. Lê a preferência do localStorage via
 * useSyncExternalStore — 'light' (DEFAULT_THEME) no server e o
 * valor real no client. Enquanto em 'system', escuta a troca de esquema do SO
 * em tempo real, removendo o listener no cleanup / ao sair de 'system'.
 */
export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore<Theme>(subscribeTheme, getTheme, () => DEFAULT_THEME)

  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const update = useCallback((t: Theme) => setTheme(t), [])

  return [theme, update]
}
