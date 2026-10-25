import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { safeNext } from '@/lib/auth/safe-next'
import { configuredProviders } from '@/lib/auth/oauth/core'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = { title: 'Entrar — HouseArt' }

const SOCIAL_CODE = /^[a-z-]{1,20}$/

// The photo behind the claim panel: a public-domain painting (Van Gogh, MoMA) stored in the house's
// public media (uploaded by the content editor on 2026-10-23 — the repo only keeps the path; in a dev
// base without it the panel shows the gradient alone).
const LOGIN_WALL = { src: '/api/public/media/content/news/1792772349313-1i5ga4cihuc.jpg', credit: 'Vincent van Gogh · A noite estrelada, 1889 · domínio público' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; social?: string }> }) {
  const sp = await searchParams
  const next = safeNext(sp.next)
  if (await getSession()) redirect(next ?? '/')
  const social = sp.social && SOCIAL_CODE.test(sp.social) ? sp.social : null
  return (
    <AuthShell variant="claim" brandHeight={56} className="ha-login--entrar" wall={LOGIN_WALL}>
      <LoginForm next={next} providers={configuredProviders(process.env)} social={social} />
    </AuthShell>
  )
}
