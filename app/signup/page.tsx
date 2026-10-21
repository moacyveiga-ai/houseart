import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { SignupForm } from '@/components/auth/SignupForm'

export const metadata = { title: 'Criar conta — HouseArt' }

export default function SignupPage() {
  return (
    <main className="ha-login">
      <section className="ha-login__art" aria-hidden="true" />
      <section className="ha-login__form">
        <HouseArtLogo size={24} />
        <h1 className="ha-h2">Criar conta</h1>
        <p className="ha-muted">Escolha como você vai usar a HouseArt. Você pode adicionar outros perfis depois.</p>
        <SignupForm />
      </section>
    </main>
  )
}
