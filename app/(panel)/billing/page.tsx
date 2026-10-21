import { requirePanelPage } from '../_session'
import { billingView } from '@/lib/billing/server'
import { BillingScreen } from '@/components/billing/BillingScreen'
import { flagOn } from '@/lib/flags'

export const metadata = { title: 'Cobrança — HouseArt' }

export default async function BillingPage() {
  const { scope, user } = await requirePanelPage('/billing')
  const v = await billingView(scope, user.id)
  return (
    <div className="ha-page">
      <BillingScreen
        plan={v.plan ? { ...v.plan, priceCents: v.plan.priceCents.toString() } : null}
        options={v.options.map((o) => ({ code: o.code, name: o.name, description: o.description, priceCents: o.priceCents.toString() }))}
        monthLabel={v.monthLabel}
        bars={v.bars}
        invoices={v.invoices.map((i) => ({ ...i, amountCents: i.amountCents.toString() }))}
        plansOn={flagOn('FLAG_PLANS')}
      />
    </div>
  )
}
