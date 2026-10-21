// ownership-wallet-item (molécula): a escritura na carteira do colecionador.
import type { ReactNode } from 'react'

export function WalletItem({ src, title, year, meta, actions }: { src: string | null; title: string; year?: number | null; meta: ReactNode; actions: ReactNode }) {
  return (
    <div className="ha-wallet-item">
      <div className="ha-wallet-item__wall">
        {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
        {src ? <img src={src} alt="" /> : null}
      </div>
      <div className="ha-wallet-item__body">
        <div className="ha-wallet-item__title">{title}{year ? <>, <em>{year}</em></> : null}</div>
        <div className="ha-wallet-item__meta">{meta}</div>
        <div className="ha-wallet-item__actions">{actions}</div>
      </div>
    </div>
  )
}
