// artwork-frame (átomo): `passepartout` = moldura ink-900 + passe-partout 12 ·
// `canvas` = tela sem moldura com sombra de parede · `dark` = viewing room.
export type FrameMode = 'passepartout' | 'canvas' | 'dark'

export function ArtworkFrame({ src, alt = '', mode = 'passepartout', square = false, className = '' }: { src: string; alt?: string; mode?: FrameMode; square?: boolean; className?: string }) {
  const cls = ['ha-frame', mode === 'canvas' ? 'ha-frame--canvas' : mode === 'dark' ? 'ha-frame--dark' : '', square ? 'ha-frame--square' : '', className].filter(Boolean).join(' ')
  // eslint-disable-next-line @next/next/no-img-element -- derivadas do cofre, tamanho pelo CSS
  return <span className={cls}><img src={src} alt={alt} /></span>
}

/** A parede atrás da obra (wall / ink-900). */
export function FrameWall({ dark = false, children }: { dark?: boolean; children: React.ReactNode }) {
  return <div className={`ha-frame-wall${dark ? ' ha-frame-wall--dark' : ''}`}>{children}</div>
}
