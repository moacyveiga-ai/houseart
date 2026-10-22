import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { configuredProviders } from '@/lib/auth/oauth/core'
import { listPublicPlans } from '@/lib/plans/server'
import { AuthShell } from '@/components/auth/AuthShell'
import { SignupForm } from '@/components/auth/SignupForm'
import { SignupPlanAside } from '@/components/auth/SignupPlanAside'
import { SignupPlanProvider } from '@/components/auth/SignupPlanContext'
import { pickSignupPlan, toSignupPlan } from '@/components/auth/signup-plans'
import '@/components/auth/signup.css'

export const metadata = { title: 'Criar conta — HouseArt' }

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string; social?: string; provider?: string }> }) {
  const sp = await searchParams
  // Someone already signed in resumes the onboarding (phone, interests) instead of a second account.
  if (await getSession()) redirect(`/signup/welcome${sp.plan ? `?plan=${encodeURIComponent(sp.plan)}` : ''}`)
  const plans = (await listPublicPlans()).map(toSignupPlan)
  const plan = pickSignupPlan(plans, sp.plan)
  return (
    <SignupPlanProvider plans={plans} initialCode={plan?.code ?? null}>
      <AuthShell title="Criar sua conta" lead="" hideHeading className="ha-login--signup" brandHeight={48} art={{ src: '/img/signup-art.png', alt: 'Hilma af Klint, Svanen (O Cisne), nº 17, 1915' }} foot={<SignupPlanAside />}>
        <SignupForm providers={configuredProviders(process.env)} social={sp.social ?? null} socialProvider={sp.provider ?? null} />
      </AuthShell>
    </SignupPlanProvider>
  )
}
