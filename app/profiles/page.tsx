import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { safeNext } from '@/lib/auth/safe-next'
import { profilesOf } from '@/lib/profiles/server'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { ProfileChooser } from '@/components/auth/ProfileChooser'

export const metadata = { title: 'Escolha de perfil — HouseArt' }

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getSession()
  if (!user) redirect('/login?next=%2Fprofiles')
  const cards = await profilesOf(user)
  const next = safeNext((await searchParams).next)
  return (
    <main className="ha-page ha-page--loose">
      <div className="ha-stack" style={{ maxWidth: 960, margin: '0 auto' }}>
        <HouseArtLogo height={30} />
        <p className="ha-eyebrow">Conta verificada · {user.name}</p>
        <h1 className="ha-h1">Como você vai usar a HouseArt?</h1>
        <p className="ha-muted">Você pode ter mais de um perfil e trocar quando quiser no menu do avatar.</p>
        <ProfileChooser cards={cards} next={next} />
      </div>
    </main>
  )
}
