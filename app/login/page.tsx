import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { safeNext } from '@/lib/auth/safe-next'
import { configuredProviders } from '@/lib/auth/oauth/core'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = { title: 'Entrar — HouseArt' }

const SOCIAL_CODE = /^[a-z-]{1,20}$/

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; social?: string }> }) {
  const sp = await searchParams
  const next = safeNext(sp.next)
  if (await getSession()) redirect(next ?? '/profiles')
  const social = sp.social && SOCIAL_CODE.test(sp.social) ? sp.social : null
  return (
    <AuthShell variant="claim" brandHeight={30} className="ha-login--entrar">
      <LoginForm next={next} providers={configuredProviders(process.env)} social={social} />
    </AuthShell>
  )
}
