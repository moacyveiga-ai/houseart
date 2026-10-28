'use client'
// "Instalar o HouseArt" (/install): the browser's own prompt when it offers one (Chrome/Edge on Android
// and desktop — kept by INSTALL_PROMPT_SCRIPT in the root layout), otherwise the steps of the device.
// Opened as the installed app, it says so and offers to enter.
import Link from 'next/link'
import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ds/Button'
import { INSTALL_STEPS, platformOf, type InstallPlatform } from './install-core'

interface PromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
type W = Window & { __haInstall?: PromptEvent | null; __haInstalled?: boolean }

const subscribe = (cb: () => void) => { window.addEventListener('ha-install', cb); return () => window.removeEventListener('ha-install', cb) }
const promptOf = () => (window as W).__haInstall ?? null
const standaloneOf = () => (window as W).__haInstalled === true || window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const platformNow = (): InstallPlatform => platformOf(navigator.userAgent)

export function InstallApp() {
  const prompt = useSyncExternalStore(subscribe, promptOf, () => null)
  const standalone = useSyncExternalStore(subscribe, standaloneOf, () => false)
  const platform = useSyncExternalStore(subscribe, platformNow, () => 'desktop' as InstallPlatform)
  const [busy, setBusy] = useState(false)

  if (standalone) {
    return (
      <div className="ha-stack">
        <p className="ha-login__lead">O HouseArt já está instalado neste aparelho.</p>
        <Link href="/login" className="ha-btn ha-btn--ink ha-btn--md">Entrar</Link>
      </div>
    )
  }

  async function install() {
    if (!prompt) return
    setBusy(true)
    try { await prompt.prompt(); await prompt.userChoice } finally { (window as W).__haInstall = null; window.dispatchEvent(new Event('ha-install')); setBusy(false) }
  }

  return (
    <div className="ha-stack">
      {prompt ? <Button variant="ink" size="md" loading={busy} onClick={() => void install()}>Instalar o app</Button> : null}
      <div className="ha-stack ha-stack--2">
        <span className="ha-field__label">{prompt ? 'Ou, pelo menu do navegador:' : platform === 'ios' ? 'No iPhone' : platform === 'android' ? 'No Android' : 'No computador'}</span>
        <ol className="ha-install__steps">{INSTALL_STEPS[platform].map((s) => <li key={s}>{s}</li>)}</ol>
      </div>
      <p className="ha-login__lead">O app abre direto no seu painel, em tela cheia, e recebe os avisos de propostas, vendas e entregas.</p>
      <Link href="/login" className="ha-link">Continuar no navegador</Link>
    </div>
  )
}
