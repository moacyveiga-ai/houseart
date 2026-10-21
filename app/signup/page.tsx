import { AuthShell } from '@/components/auth/AuthShell'
import { SignupForm } from '@/components/auth/SignupForm'

export const metadata = { title: 'Criar conta — HouseArt' }

export default function SignupPage() {
  return (
    <AuthShell title="Criar conta" lead="Escolha como você vai usar a HouseArt. Você pode adicionar outros perfis depois.">
      <SignupForm />
    </AuthShell>
  )
}
