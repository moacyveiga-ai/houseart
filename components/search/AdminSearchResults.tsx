// The desk's results above the public ones: artworks in any state, deals and accounts.
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Badge, type BadgeTone } from '@/components/ds/Badge'
import { initialsOf } from '@/lib/profiles/core'
import type { AdminSearchResult } from '@/lib/admin-search/core'

const STATUS_TONE: Record<string, BadgeTone> = { DRAFT: 'neutral', IN_CERTIFICATION: 'pending', AUTHENTICATED: 'verified', LISTED: 'verified', IN_DEAL: 'pending', SOLD: 'soft', ARCHIVED: 'neutral', STOLEN: 'alert', DISPUTED: 'alert' }

export function AdminSearchResults({ r }: { r: AdminSearchResult }) {
  if (!r.q || r.total === 0) return null
  return (
    <section className="ha-search-sec ha-search-admin" aria-label="Resultados da equipe">
      <span className="ha-search-sec__k">Equipe · {r.total} {r.total === 1 ? 'registro' : 'registros'} em qualquer estado</span>
      <div>
        {r.artworks.map((a) => (
          <div key={`a${a.id}`} className="ha-search-row">
            <span className="ha-search-row__av" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
              {a.cover ? <img src={a.cover} alt="" /> : <Icon name="image" size={22} />}
            </span>
            <span className="ha-search-row__t">
              <span className="ha-search-row__n">{a.title} <Badge tone={STATUS_TONE[a.status] ?? 'neutral'}>{a.statusLabel}</Badge></span>
              <span className="ha-search-row__s">{[a.artist, `de ${a.owner}`, a.publicId ?? 'sem certificado', `#${a.id}`].join(' · ')}</span>
            </span>
            <span className="ha-search-admin__acts">
              <Link href={a.href} className="ha-btn ha-btn--outline ha-btn--xs">Abrir obra</Link>
              {a.verifyHref ? <Link href={a.verifyHref} className="ha-btn ha-btn--ghost ha-btn--xs">Certificado</Link> : null}
            </span>
          </div>
        ))}
        {r.deals.map((d) => (
          <Link key={`d${d.id}`} href={d.href} className="ha-search-row">
            <span className="ha-search-row__av ha-search-row__av--gallery" aria-hidden="true"><Icon name="handshake" size={22} /></span>
            <span className="ha-search-row__t">
              <span className="ha-search-row__n">{d.code} <Badge tone={d.exception === 'CANCELLED' ? 'neutral' : d.exception ? 'alert' : d.phase === 'COMPLETED' ? 'verified' : 'pending'}>{d.exception === 'CANCELLED' ? 'Cancelado' : d.exception === 'DISPUTE' ? 'Em disputa' : d.phaseLabel}</Badge></span>
              <span className="ha-search-row__s">{d.artworkTitle} · {d.seller} → {d.buyer}</span>
            </span>
            <Icon name="chevron_right" size={20} className="ha-search-row__arrow" />
          </Link>
        ))}
        {r.users.map((u) => (
          <Link key={`u${u.id}`} href={u.href} className="ha-search-row">
            <span className="ha-search-row__av" aria-hidden="true">{initialsOf(u.name)}</span>
            <span className="ha-search-row__t">
              <span className="ha-search-row__n">{u.name} <Badge tone={u.active ? 'ink' : 'alert'}>{u.active ? u.profileLabel : 'Bloqueada'}</Badge></span>
              <span className="ha-search-row__s">{[u.email, u.member, `#${u.id}`].filter(Boolean).join(' · ')}</span>
            </span>
            <Icon name="chevron_right" size={20} className="ha-search-row__arrow" />
          </Link>
        ))}
      </div>
    </section>
  )
}
