import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { inviteByToken } from '@/lib/gallery/team-server'
import { TEAM_ROLE_LABELS } from '@/lib/gallery/domain'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { Icon } from '@/components/ds/Icon'
import { AcceptInviteScreen } from '@/components/gallery/AcceptInviteScreen'
import '@/components/gallery/team.css'

export const metadata = { title: 'Convite para a equipe — HouseArt' }

/** The link of the invite e-mail (`<APP_URL>/team/accept?token=…`). Needs a session: without one, to /login with `next`. */
export default async function TeamAcceptPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? ''
  const user = await getSession()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/team/accept?token=${token}`)}`)
  const invite = token ? await inviteByToken(token) : null
  return (
    <main className="ha-page ha-page--loose">
      <div className="ha-team-accept">
        <HouseArtLogo height={30} />
        {invite ? (
          <>
            <span className="ha-team-accept__ic"><Icon name="groups" size={28} /></span>
            <h1 className="ha-h2">Você foi convidado(a) para a equipe de {invite.galleryName} como {TEAM_ROLE_LABELS[invite.role].name}</h1>
            <p className="ha-muted ha-sm" style={{ margin: 0 }}>{TEAM_ROLE_LABELS[invite.role].sub}. Você entra com a conta {user.email}.</p>
            <AcceptInviteScreen token={token} inviteEmail={invite.email} userEmail={user.email} />
          </>
        ) : (
          <>
            <span className="ha-team-accept__ic"><Icon name="link_off" size={28} /></span>
            <h1 className="ha-h2">Convite inválido ou expirado</h1>
            <p className="ha-muted ha-sm" style={{ margin: 0 }}>Convites valem por 7 dias e só uma vez. Peça um novo convite a quem administra a galeria.</p>
          </>
        )}
      </div>
    </main>
  )
}
