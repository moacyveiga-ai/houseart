// valuation-gauge (molécula): faixa mínimo–máximo em ink-900, marca sand no sugerido.
export function ValuationGauge({ min, suggested, max, format, tag = 'Estimativa de referência' }: { min: number; suggested: number; max: number; format: (v: number) => string; tag?: string | null }) {
  // The track spans 0–100 %; the range occupies 18 %–78 % of it (as drawn in the handoff) and the mark sits proportionally inside.
  const left = 18, right = 22
  const span = Math.max(max - min, 1)
  const pos = left + ((Math.min(Math.max(suggested, min), max) - min) / span) * (100 - left - right)
  return (
    <div className="ha-gauge">
      <div className="ha-gauge__track" aria-hidden="true">
        <div className="ha-gauge__base" />
        <div className="ha-gauge__range" style={{ left: `${left}%`, right: `${right}%` }} />
        <div className="ha-gauge__mark" style={{ left: `${pos}%` }} />
      </div>
      <div className="ha-gauge__legend">
        <div><div className="ha-gauge__label">Mínimo</div><div className="ha-gauge__value">{format(min)}</div></div>
        <div><div className="ha-gauge__label">Sugerido</div><div className="ha-gauge__value">{format(suggested)}</div></div>
        <div><div className="ha-gauge__label">Máximo</div><div className="ha-gauge__value">{format(max)}</div></div>
      </div>
      {tag ? <span className="ha-gauge__tag">{tag}</span> : null}
    </div>
  )
}
