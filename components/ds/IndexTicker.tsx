// index-ticker (molécula): faixa ink-900 com Índice HouseArt, dólar e euro.
export interface TickerItem { label: string; value: string; delta?: string }

export function IndexTicker({ items, align = 'right' }: { items: TickerItem[]; align?: 'left' | 'right' }) {
  if (items.length === 0) return null
  return (
    <div className={`ha-ticker${align === 'left' ? ' ha-ticker--left' : ''}`} aria-label="Índices do mercado">
      {items.map((t) => (
        <span key={t.label}>{t.label} <b>{t.value}</b>{t.delta ? <> <span className="ha-ticker__delta">{t.delta}</span></> : null}</span>
      ))}
    </div>
  )
}
