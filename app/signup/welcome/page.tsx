// Continuation of a social signup (the OAuth callback lands here, signed in):
// the same island from step 3 — phone by SMS, interests, "Conta criada".
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { listPublicPlans } from '@/lib/plans/server'
import { AuthShell } from '@/components/auth/AuthShell'
import { SignupForm } from '@/components/auth/SignupForm'
import { SignupPlanAside } from '@/components/auth/SignupPlanAside'
import { SignupPlanProvider } from '@/components/auth/SignupPlanContext'
import { pickSignupPlan, toSignupPlan } from '@/components/auth/signup-plans'
import '@/components/auth/signup.css'

export const metadata = { title: 'Concluir cadastro — HouseArt' }

export default async function SignupWelcomePage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const sp = await searchParams
  const user = await getSession()
  if (!user) redirect(`/signup${sp.plan ? `?plan=${encodeURIComponent(sp.plan)}` : ''}`)
  const plans = (await listPublicPlans()).map(toSignupPlan)
  const plan = sp.plan ? pickSignupPlan(plans, sp.plan) : null
  return (
    <SignupPlanProvider plans={plans} initialCode={plan?.code ?? null} locked>
      <AuthShell title="Concluir cadastro" lead="" hideHeading className="ha-login--signup" brandHeight={30} foot={plan ? <SignupPlanAside /> : undefined}>
        <SignupForm providers={[]} startAt={3} account={{ name: user.name, email: user.email }} />
      </AuthShell>
    </SignupPlanProvider>
  )
}
