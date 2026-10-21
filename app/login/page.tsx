import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { safeNext } from '@/lib/auth/safe-next'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = { title: 'Entrar — HouseArt' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams
  const next = safeNext(sp.next)
  if (await getSession()) redirect(next ?? '/profiles')
  return (
    <main className="ha-login">
      <section className="ha-login__art" aria-hidden="true">
        <div className="ha-login__caption">
          <div className="ha-eyebrow">Joana Teixeira ·</div>
          <div className="ha-title">Construção para um dia claro, 2025</div>
        </div>
      </section>
      <section className="ha-login__form">
        <HouseArtLogo size={24} />
        <p className="ha-eyebrow">A escritura da obra de arte</p>
        <h1 className="ha-h2">Entrar</h1>
        <p className="ha-muted">Use a mesma conta da família House.</p>
        <LoginForm next={next} />
      </section>
    </main>
  )
}
