import { AuthShell } from '@/components/auth/AuthShell'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata = { title: 'Recuperar senha — HouseArt' }

export default function RecoverPasswordPage() {
  return (
    <AuthShell title="Recuperar senha" lead="Informe o e-mail da conta. Se ele existir, enviamos um link que vale por 1 hora.">
      <ForgotPasswordForm />
    </AuthShell>
  )
}
