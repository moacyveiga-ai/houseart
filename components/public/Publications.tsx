// "E-books e publicações" / "E-books e catálogos": the ink band of the Artista and
// Galeria prototypes. Price formatted or "Grátis"; the action opens `url` when there
// is one and is announced as "Em breve" otherwise (there is no store yet).
import { Icon } from '@/components/ds/Icon'
import { PUBLICATION_ACTION_LABELS, PUBLICATION_KIND_LABELS } from '@/lib/public-content/domain'
import { publicationPrice } from '@/lib/public-content/profile-core'
import './publications.css'

export interface PublicationItem { kind: string; title: string; meta: string | null; priceCents: bigint | null; action: string; url: string | null; coverUrl: string | null }

export function Publications({ id, title, subtitle, items }: { id: string; title: string; subtitle: string; items: PublicationItem[] }) {
  if (!items.length) return null
  return (
    <section id={id} className="hp-pubs">
      <div className="hp-pubs__inner">
        <div className="hp-pubs__titles">
          <h2 className="hp-section-title">{title}</h2>
          <span className="hp-pubs__sub">{subtitle}</span>
        </div>
        <div className="hp-pubs__grid">
          {items.map((b, i) => {
            const act = PUBLICATION_ACTION_LABELS[b.action as keyof typeof PUBLICATION_ACTION_LABELS] ?? PUBLICATION_ACTION_LABELS.READ
            const kind = PUBLICATION_KIND_LABELS[b.kind as keyof typeof PUBLICATION_KIND_LABELS] ?? b.kind
            return (
              <div key={`${b.title}-${i}`} className="hp-pubs-item">
                <div className="hp-pubs-item__cover">
                  {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                  {b.coverUrl ? <img src={b.coverUrl} alt="" loading="lazy" /> : null}
                </div>
                <span className="hp-pubs-item__kind">{kind}</span>
                <span className="hp-pubs-item__title">{b.title}</span>
                {b.meta ? <span className="hp-pubs-item__meta">{b.meta}</span> : null}
                <div className="hp-pubs-item__foot">
                  <span className="hp-pubs-item__price">{publicationPrice(b.priceCents)}</span>
                  {b.url ? (
                    <a href={b.url} target="_blank" rel="noopener noreferrer" className="hp-pubs-item__btn"><Icon name={act.icon} size={18} />{act.label}</a>
                  ) : (
                    <span className="hp-pubs-item__btn" role="button" aria-disabled="true" title="Em breve"><Icon name={act.icon} size={18} />{act.label}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
