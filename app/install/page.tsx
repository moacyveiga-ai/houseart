// "Instalar o HouseArt" — public page to send to anyone (the link the team shares): installs the panel
// as an app on the phone or the computer (app/manifest.ts). Same entrance panel as the login.
import { AuthShell } from '@/components/auth/AuthShell'
import { InstallApp } from '@/components/pwa/InstallApp'
import { randomWall } from '@/lib/public-content/paintings'
import '@/components/pwa/install.css'

export const metadata = { title: 'Instalar o app — HouseArt', description: 'Instale o HouseArt no celular ou no computador, direto pelo navegador.' }

export default function InstallPage() {
  return (
    <AuthShell variant="claim" brandHeight={56} wall={randomWall()} title="Instalar o app" lead="O HouseArt vai para a tela inicial do celular, como um app, sem passar pela loja.">
      <InstallApp />
    </AuthShell>
  )
}
