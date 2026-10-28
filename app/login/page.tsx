import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { panelSession } from '@/lib/auth/panel'
import { safeNext } from '@/lib/auth/safe-next'
import { configuredProviders } from '@/lib/auth/oauth/core'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'
import { STARRY_NIGHT, paintingCredit } from '@/lib/public-content/paintings'

export const metadata = { title: 'Entrar — HouseArt' }

const SOCIAL_CODE = /^[a-z-]{1,20}$/

// The photo behind the claim panel: a public-domain painting (Van Gogh, MoMA) stored in the house's
// public media (uploaded by the content editor on 2026-10-23 — the repo only keeps the path; in a dev
// base without it the panel shows the gradient alone).
const LOGIN_WALL = { src: STARRY_NIGHT.src, credit: paintingCredit(STARRY_NIGHT) }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; social?: string }> }) {
  const sp = await searchParams
  const next = safeNext(sp.next)
  if (await getSession()) redirect((await panelSession()) ? next ?? '/' : '/e')
  const social = sp.social && SOCIAL_CODE.test(sp.social) ? sp.social : null
  return (
    <AuthShell variant="claim" brandHeight={56} className="ha-login--entrar" wall={LOGIN_WALL}>
      <LoginForm next={next} providers={configuredProviders(process.env)} social={social} />
    </AuthShell>
  )
}
