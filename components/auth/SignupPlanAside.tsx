'use client'
// "Plano escolhido" of the ink aside (HouseArt Cadastro.dc.html): name, price,
// the row of plan chips (switch without leaving the page) and the note.
import { useSignupPlan } from './SignupPlanContext'

export function SignupPlanAside() {
  const { plans, plan, choose, locked } = useSignupPlan()
  if (!plan) return null
  return (
    <div className="ha-signup-plan">
      <span className="ha-signup-plan__eyebrow">Plano escolhido</span>
      <div className="ha-signup-plan__head">
        <span className="ha-signup-plan__name">{plan.name}</span>
        <span className="ha-signup-plan__price">{plan.price}<span className="ha-signup-plan__per">{plan.per}</span></span>
      </div>
      {locked ? null : (
        <div className="ha-signup-plan__chips" role="radiogroup" aria-label="Trocar de plano">
          {plans.map((p) => (
            <button key={p.code} type="button" role="radio" aria-checked={p.code === plan.code} className={`ha-signup-plan__chip${p.code === plan.code ? ' ha-signup-plan__chip--on' : ''}`} onClick={() => choose(p.code)}>{p.short}</button>
          ))}
        </div>
      )}
      <span className="ha-signup-plan__note">{plan.note}</span>
    </div>
  )
}
