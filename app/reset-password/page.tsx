import { AuthShell } from '@/components/auth/AuthShell'
import { randomWall } from '@/lib/public-content/paintings'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata = { title: 'Nova senha — HouseArt' }

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return (
    <AuthShell variant="claim" brandHeight={56} wall={randomWall()} title="Nova senha" lead="Escolha uma senha nova. Ao salvar, todas as sessões abertas são encerradas.">
      <ResetPasswordForm token={typeof token === 'string' ? token : ''} />
    </AuthShell>
  )
}
