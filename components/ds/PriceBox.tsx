// price-box (molécula): valor, parcelas, frete e seguro, comprar (color) + oferta (bord).
import type { ReactNode } from 'react'

export function PriceBox({ value, note, shippingLabel, shippingValue, children }: { value: string; note?: string; shippingLabel?: string; shippingValue?: string; children: ReactNode }) {
  return (
    <div className="ha-price-box">
      <div><div className="ha-price-box__value">{value}</div>{note ? <div className="ha-price-box__note">{note}</div> : null}</div>
      {shippingLabel ? <div className="ha-price-box__line"><span>{shippingLabel}</span><b>{shippingValue}</b></div> : null}
      {children}
    </div>
  )
}
