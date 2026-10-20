// As rotas SEMPRE claras e o script anti-flash — módulo PURO, sem 'use client',
// porque o root layout (Server Component) chama `antiFlashScript()` no render.
// lib/theme.ts é 'use client': importar uma função de lá no servidor derruba
// TODA página ("Attempted to call antiFlashScript() from the server") — a
// mesma armadilha do `initialsOf` na 9.6 (só COMPONENTES cruzam a fronteira).
// O teste lib/theme.test.ts trava que este arquivo não ganhe a diretiva.

/**
 * As árvores que são SEMPRE claras (portal, área do cliente, landing do
 * as telas de entrada — login, recuperar e
 * redefinir senha: quem não está logado não tem tema escolhido, e o claro é o
 * padrão; depois de entrar vale o tema salvo, 2026-10-06) — a lista única que `rotaSempreClara`
 * (lib/theme.ts), o script anti-flash do root layout e o teste de
 * `components/layout/AppShell.tsx` leem. Três cópias à mão divergiam (9.7).
 */
export const ALWAYS_LIGHT_ROUTES = ['/e', '/login', '/signup', '/recover-password', '/reset-password', '/verify', '/privacy'] as const

export function isAlwaysLightRoute(pathname: string): boolean {
  return ALWAYS_LIGHT_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))
}

/**
 * O script inline do <head> que aplica o tema salvo ANTES da pintura (senão
 * a página pisca no tema errado). Gerado daqui para a lista de rotas claras
 * ser a mesma de `rotaSempreClara`.
 */
export function antiFlashScript(): string {
  const rotas = JSON.stringify(ALWAYS_LIGHT_ROUTES)
  return `(function(){try{var t=localStorage.getItem('ha-theme');if(t!=='light'&&t!=='dark'&&t!=='system')t='system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var p=location.pathname;var c=${rotas};for(var i=0;i<c.length;i++){if(p===c[i]||p.indexOf(c[i]+'/')===0)d=false;}document.documentElement.setAttribute('data-ha-theme',d?'dark':'');}catch(e){}})();`
}
