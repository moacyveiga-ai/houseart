export function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="ha-stepper">
      {steps.map((s, i) => (
        <li key={s} className={`ha-step${i < current ? ' ha-step--done' : ''}${i === current ? ' ha-step--on' : ''}`} aria-current={i === current ? 'step' : undefined}>
          <span className="ha-step__dot">{i + 1}</span>
          <span className="ha-step__name">{s}</span>
        </li>
      ))}
    </ol>
  )
}
