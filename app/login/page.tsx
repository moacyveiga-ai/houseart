import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { panelSession } from '@/lib/auth/panel'
import { safeNext } from '@/lib/auth/safe-next'
import { configuredProviders } from '@/lib/auth/oauth/core'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'
import { randomWall } from '@/lib/public-content/paintings'

export const metadata = { title: 'Entrar — HouseArt' }

const SOCIAL_CODE = /^[a-z-]{1,20}$/

// The photo behind the claim panel: a public-domain painting picked at random on each visit
// (`randomWall`, the same list as /signup/welcome — Moacy, 2026-10-28). The files live in the house's
// public media; in a dev base without them the panel shows the gradient alone.

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; social?: string }> }) {
  const sp = await searchParams
  const next = safeNext(sp.next)
  if (await getSession()) redirect((await panelSession()) ? next ?? '/' : '/e')
  const social = sp.social && SOCIAL_CODE.test(sp.social) ? sp.social : null
  return (
    <AuthShell variant="claim" brandHeight={56} className="ha-login--entrar" wall={randomWall()}>
      <LoginForm next={next} providers={configuredProviders(process.env)} social={social} />
    </AuthShell>
  )
}
