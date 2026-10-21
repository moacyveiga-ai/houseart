// split-summary (molécula): barra proporcional + linhas por parte + total. Visível só ao vendedor.
export interface SplitPart { label: string; cents: bigint; tone: 'ink' | 'muted' | 'sand' }

const COLOR = { ink: 'var(--ha-ink-900)', muted: 'var(--ha-ink-500)', sand: 'var(--ha-sand-500)' } as const

export function SplitSummary({ parts, total, format, note = 'Visível só ao vendedor. Frete e seguro são repassados à parte.' }: { parts: SplitPart[]; total: bigint; format: (cents: bigint) => string; note?: string | null }) {
  const sum = parts.reduce((a, p) => a + p.cents, 0n)
  const pct = (c: bigint) => (sum > 0n ? Number((c * 10000n) / sum) / 100 : 0)
  return (
    <div className="ha-split-summary">
      <div className="ha-split-summary__bar" aria-hidden="true">
        {parts.map((p) => <span key={p.label} style={{ width: `${pct(p.cents)}%`, background: COLOR[p.tone] }} />)}
      </div>
      <div className="ha-split-summary__rows">
        {parts.map((p) => (
          <div key={p.label} className="ha-split-summary__row">
            <span className="ha-split-summary__who"><span className="ha-split-summary__swatch" style={{ background: COLOR[p.tone] }} />{p.label}</span>
            <span>{format(p.cents)}</span>
          </div>
        ))}
        <div className="ha-split-summary__row ha-split-summary__row--total"><span>Total da obra</span><span>{format(total)}</span></div>
      </div>
      {note ? <div className="ha-split-summary__note">{note}</div> : null}
    </div>
  )
}
