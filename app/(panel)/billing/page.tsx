import { requirePanelPage } from '../_session'
import { billingView } from '@/lib/billing/server'
import { BillingScreen } from '@/components/billing/BillingScreen'
import { flagOn } from '@/lib/flags'
import { houseBilling } from '@/lib/billing/house-server'
import { HouseBillingScreen } from '@/components/billing/HouseBillingScreen'

export const metadata = { title: 'Cobrança — HouseArt' }

export default async function BillingPage() {
  const { scope, user, nav } = await requirePanelPage('/billing')
  if (nav === 'admin') {
    const h = await houseBilling()
    const s = (c: bigint) => c.toString()
    return (
      <div className="ha-page">
        <HouseBillingScreen monthLabel={h.monthLabel} revenueCents={s(h.revenueCents)} revenueByKind={h.revenueByKind.map((k) => ({ ...k, cents: s(k.cents) }))} commissionHeldCents={s(h.commissionHeldCents)}
          activePlans={h.activePlans} pastDuePlans={h.pastDuePlans}
          payouts={{ pendingCount: h.payouts.pendingCount, pendingCents: s(h.payouts.pendingCents), failed: h.payouts.failed.map((f) => ({ ...f, amountCents: s(f.amountCents) })) }}
          invoices={h.invoices.map((i) => ({ ...i, amountCents: s(i.amountCents) }))} />
      </div>
    )
  }
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
