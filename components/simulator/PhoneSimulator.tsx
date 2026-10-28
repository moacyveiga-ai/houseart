'use client'
// The native app (apps/mobile, React Native) exported for the web and served at /app,
// inside a phone frame. It is the app's own code — native screens, tabs, splash and
// login by bearer — not the responsive panel.
import { useState } from 'react'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { Icon } from '@/components/ds/Icon'
import './simulator.css'

const DEVICES = [
  { key: 'iphone', label: 'iPhone 15', w: 393, h: 852 },
  { key: 'android', label: 'Android', w: 412, h: 915 },
  { key: 'small', label: 'Tela pequena', w: 360, h: 740 },
] as const

export function PhoneSimulator() {
  const [device, setDevice] = useState<(typeof DEVICES)[number]['key']>('iphone')
  const [nonce, setNonce] = useState(0)
  const d = DEVICES.find((x) => x.key === device) ?? DEVICES[0]
  return (
    <main className="ha-sim">
      <aside className="ha-sim__side">
        <HouseArtLogo version="full_horiz" tone="auto" height={30} />
        <h1 className="ha-sim__title">Simulador do app</h1>
        <p className="ha-sim__lead">Estas são as telas do app de celular — o mesmo código do app nativo, rodando aqui no navegador. Entre com a sua conta: cada perfil abre o seu app (Colecionador, Galeria ou Artista).</p>
        <div className="ha-sim__devices" role="radiogroup" aria-label="Aparelho">
          {DEVICES.map((x) => (
            <button key={x.key} type="button" role="radio" aria-checked={x.key === device} className={`ha-chip${x.key === device ? ' ha-chip--on' : ''}`} onClick={() => setDevice(x.key)}>{x.label}</button>
          ))}
        </div>
        <div className="ha-sim__actions">
          <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => setNonce((n) => n + 1)}><Icon name="restart_alt" size={18} />Recomeçar</button>
          <a className="ha-btn ha-btn--ghost ha-btn--sm" href="/app" target="_blank" rel="noopener">Abrir em tela cheia <Icon name="open_in_new" size={18} /></a>
        </div>
        <ul className="ha-sim__notes">
          <li>No celular, abra <b>/app</b> direto: ocupa a tela inteira, como o app.</li>
          <li>O que precisa do aparelho não roda aqui: leitura da etiqueta NFC, notificações e a câmera (vira escolher arquivo).</li>
          <li>As poucas telas que o app abre como página web usam a sessão do site neste navegador.</li>
        </ul>
      </aside>
      <div className="ha-sim__stage">
        <div className="ha-sim__phone" style={{ width: d.w + 24, height: d.h + 24 }}>
          <iframe key={`${device}-${nonce}`} src="/app" title="App HouseArt" className="ha-sim__screen" style={{ width: d.w, height: d.h }} allow="camera; clipboard-write" />
        </div>
        <span className="ha-sim__size">{d.w} × {d.h}</span>
      </div>
    </main>
  )
}
