import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { safeNext } from '@/lib/auth/safe-next'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = { title: 'Entrar — HouseArt' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams
  const next = safeNext(sp.next)
  if (await getSession()) redirect(next ?? '/profiles')
  return (
    <AuthShell title="Entrar" lead="Use a mesma conta da família House.">
      <LoginForm next={next} />
    </AuthShell>
  )
}
