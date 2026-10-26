'use client'
// "Para quem" of the public site: three tabs (Artistas · Galerias · Colecionadores),
// each with its title, checklist, CTA and a wall image handed by the server.
import { useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'

export interface AudienceImage { src: string; alt: string }

const AUDIENCES = [
  { name: 'Artistas', title: 'Sua obra com nome, data e dono para sempre.', cta: 'Certificar minhas obras', href: '/signup', items: ['Cadastro pelo celular em menos de dez minutos por obra', 'Certificado com assinatura digital e carimbo do tempo', '5% da valorização a cada revenda, automático', 'Perfil público ligado ao seu Instagram'] },
  { name: 'Galerias', title: 'Seu inventário inteiro com escritura.', cta: 'Falar com a equipe', href: '/signup', items: ['Certificação em lote em nome dos artistas representados', 'Viewing rooms privados e CRM de colecionadores', 'Frete, seguro e exportação assistida no checkout', 'Repartição automática entre galeria, artista e parceiros'] },
  { name: 'Colecionadores', title: 'Sua coleção como patrimônio registrado.', cta: 'Abrir minha carteira', href: '/wallet', items: ['Carteira de escrituras com certificado e proveniência', 'Pagamento em garantia: só libera depois que a obra chega', 'Seguro, laudo de valor e revenda a partir da carteira', 'Transferência registrada mesmo em vendas fora da plataforma'] },
] as const

export function SiteAudienceTabs({ images }: { images: (AudienceImage | null)[] }) {
  const [active, setActive] = useState(0)
  const a = AUDIENCES[active]
  const img = images[active] ?? null
  return (
    <>
      <div className="hp-site-for__tabs" role="tablist" aria-label="Para quem">
        {AUDIENCES.map((t, i) => (
          <button key={t.name} type="button" role="tab" id={`hp-site-for-tab-${i}`} aria-selected={i === active} aria-controls="hp-site-for-panel" className={`hp-site-for__tab${i === active ? ' hp-site-for__tab--on' : ''}`} onClick={() => setActive(i)}>{t.name}</button>
        ))}
      </div>
      <div className="hp-site-for__panel" role="tabpanel" id="hp-site-for-panel" aria-labelledby={`hp-site-for-tab-${active}`}>
        <div className="hp-site-for__copy">
          <h3 className="hp-site-for__title">{a.title}</h3>
          <div className="hp-site-for__items">
            {a.items.map((t) => <div key={t} className="hp-site-for__item"><Icon name="check" size={20} /><span>{t}</span></div>)}
          </div>
          <Link href={a.href} className="hp-site-btn-ink">{a.cta}</Link>
        </div>
        {img ? (
          <div className="hp-site-for__wall">
            {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
            <img src={img.src} alt={img.alt} />
          </div>
        ) : null}
      </div>
    </>
  )
}
