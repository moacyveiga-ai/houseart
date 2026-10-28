// PWA install — PURE. Which instructions a device gets when the browser offers no install prompt.
export type InstallPlatform = 'ios' | 'android' | 'desktop'

export function platformOf(userAgent: string): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent))) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return 'desktop'
}

export const INSTALL_STEPS: Record<InstallPlatform, string[]> = {
  ios: ['Abra este endereço no Safari.', 'Toque em Compartilhar (o quadrado com a seta para cima).', 'Escolha "Adicionar à Tela de Início" e toque em Adicionar.'],
  android: ['Abra este endereço no Chrome.', 'Toque no menu ⋮, no canto de cima.', 'Escolha "Instalar app" (ou "Adicionar à tela inicial").'],
  desktop: ['Abra este endereço no Chrome ou no Edge.', 'Clique no ícone de instalar, no fim da barra de endereço.', 'Confirme em Instalar.'],
}

/** The script that keeps the browser's install prompt for the button (it may fire before React mounts). */
export const INSTALL_PROMPT_SCRIPT = "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__haInstall=e;window.dispatchEvent(new Event('ha-install'))});window.addEventListener('appinstalled',function(){window.__haInstall=null;window.__haInstalled=true;window.dispatchEvent(new Event('ha-install'))});"
