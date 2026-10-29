// Continuation of a social signup (the OAuth callback lands here, signed in):
// the same island from step 3 — phone by SMS, interests, "Conta criada". The panel is the one of the
// login (claim + wall), with a public-domain painting picked at random on each visit (Moacy, 2026-10-28).
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { listPublicPlans } from '@/lib/plans/server'
import { AuthShell } from '@/components/auth/AuthShell'
import { SignupForm } from '@/components/auth/SignupForm'
import { SignupPlanAside } from '@/components/auth/SignupPlanAside'
import { SignupPlanProvider } from '@/components/auth/SignupPlanContext'
import { pickSignupPlan, toSignupPlan } from '@/components/auth/signup-plans'
import { randomWall } from '@/lib/public-content/paintings'
import '@/components/auth/signup.css'
import '@/components/auth/login.css'

export const metadata = { title: 'Concluir cadastro — HouseArt' }

export default async function SignupWelcomePage({ searchParams }: { searchParams: Promise<{ plan?: string; plano?: string }> }) {
  const raw = await searchParams
  // the same two names as /signup (links in Portuguese say ?plano=)
  const sp = { plan: raw.plan ?? raw.plano }
  const user = await getSession()
  if (!user) redirect(`/signup${sp.plan ? `?plan=${encodeURIComponent(sp.plan)}` : ''}`)
  const plans = (await listPublicPlans()).map(toSignupPlan)
  const plan = sp.plan ? pickSignupPlan(plans, sp.plan) : null
  return (
    <SignupPlanProvider plans={plans} initialCode={plan?.code ?? null} locked>
      <AuthShell variant="claim" hideHeading className="ha-login--signup" brandHeight={56} wall={randomWall()} foot={plan ? <SignupPlanAside /> : undefined}>
        <SignupForm providers={[]} startAt={3} account={{ name: user.name, email: user.email }} />
      </AuthShell>
    </SignupPlanProvider>
  )
}
