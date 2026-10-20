export interface KpiData { label: string; value: string; note?: string }

export function Kpi({ label, value, note }: KpiData) {
  return (
    <div className="ha-kpi">
      <div className="ha-kpi__label">{label}</div>
      <div className="ha-kpi__value">{value}</div>
      {note ? <div className="ha-kpi__note">{note}</div> : null}
    </div>
  )
}

export function Kpis({ items }: { items: KpiData[] }) {
  return <div className="ha-kpis">{items.map((k) => <Kpi key={k.label} {...k} />)}</div>
}
