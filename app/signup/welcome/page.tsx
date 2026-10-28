// Continuation of a social signup (the OAuth callback lands here, signed in):
// the same island from step 3 — phone by SMS, interests, "Conta criada". The panel is the one of the
// login (claim + wall), with a public-domain painting picked at random on each visit (Moacy, 2026-10-28).
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { listPublicPlans } from '@/lib/plans/server'
import { AuthShell } from '@/components/auth/AuthShell'
import { SignupForm } from '@/components/auth/SignupForm'
import { SignupPlanProvider } from '@/components/auth/SignupPlanContext'
import { pickSignupPlan, toSignupPlan } from '@/components/auth/signup-plans'
import { randomWall } from '@/lib/public-content/paintings'
import '@/components/auth/signup.css'
import '@/components/auth/login.css'

export const metadata = { title: 'Concluir cadastro — HouseArt' }

export default async function SignupWelcomePage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const sp = await searchParams
  const user = await getSession()
  if (!user) redirect(`/signup${sp.plan ? `?plan=${encodeURIComponent(sp.plan)}` : ''}`)
  const plans = (await listPublicPlans()).map(toSignupPlan)
  const plan = sp.plan ? pickSignupPlan(plans, sp.plan) : null
  return (
    <SignupPlanProvider plans={plans} initialCode={plan?.code ?? null} locked>
      <AuthShell variant="claim" hideHeading className="ha-login--entrar ha-login--signup" brandHeight={56} wall={randomWall()}>
        <SignupForm providers={[]} startAt={3} account={{ name: user.name, email: user.email }} />
      </AuthShell>
    </SignupPlanProvider>
  )
}
