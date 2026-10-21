// "Como funciona" — the institutional site of the handoff (HouseArt Site.dc.html).
// Header and footer come from app/e/layout.tsx; here the sections from the hero on.
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { SiteAudienceTabs, type AudienceImage } from './SiteAudienceTabs'
import { PLAN_AUDIENCE_LABELS, planCtaLabel, priceLabel } from '@/lib/plans/core'
import type { PublicPlan } from '@/lib/plans/server'
import './site.css'

export interface SiteHero { publicId: string; artist: string; title: string; year: number | null; cover: string; back: string | null }
export interface SiteFeeGroup { icon: string; title: string; items: { name: string; desc: string; value: string }[] }
export interface SiteUser { href: string; name: string; meta: string }
export interface SiteData { hero: SiteHero | null; audienceImages: (AudienceImage | null)[]; plans: PublicPlan[]; fees: SiteFeeGroup[]; users: SiteUser[] }

const PILLARS = [
  { icon: 'verified', title: 'Certifique', text: 'Etiqueta física, ID único e certificado com validade jurídica, emitido pelo artista ou pela galeria.' },
  { icon: 'storefront', title: 'Compre / Venda', text: 'Marketplace primário e secundário com pagamento em garantia, frete e seguro cotados no checkout.' },
  { icon: 'shield', title: 'Proteja', text: 'Laudo de valor, apólice e cadeia de titularidade sempre à mão, em qualquer lugar.' },
]

const FIGURES = [
  { n: 'R$ 3,1 bi', text: 'movimentados pelo mercado de arte brasileiro em 2025.' },
  { n: '1%', text: 'das vendas de galerias passam por plataformas. O resto vai por WhatsApp, Instagram e balcão.' },
  { n: '50%', text: 'das obras em circulação são falsas ou mal atribuídas, segundo estimativa conservadora.' },
]

const STEPS = [
  { name: 'A etiqueta no verso', desc: 'Única por obra, com criptografia própria. Se for descolada, deixa de valer.' },
  { name: 'O toque do celular', desc: 'Sem aplicativo: qualquer celular lê a etiqueta e abre a página da obra.' },
  { name: 'A escritura pública', desc: 'Artista, ano, técnica, certificação e cadeia de titularidade, com o dono protegido.' },
]

function StepText({ n, name, desc }: { n: number; name: string; desc: string }) {
  return <div className="hp-site-step__text"><span className="hp-site-step__n">{n}</span><div><div className="hp-site-step__name">{name}</div><div className="hp-site-step__desc">{desc}</div></div></div>
}

export function Site({ hero, audienceImages, plans, fees, users }: SiteData) {
  return (
    <div className="hp-site">
      <section id="topo" className="hp-site-hero">
        <div className="hp-site-hero__inner">
          <div className="hp-site-hero__copy">
            <div className="hp-site-hero__eyebrow">Registro, autenticação e mercado para a arte brasileira</div>
            <h1 className="hp-site-hero__title">A escritura da obra de arte</h1>
            <p className="hp-site-hero__lead">Cada obra sai do ateliê com uma etiqueta de autenticação no verso e um certificado assinado que muda de titular a cada venda, como a escritura de um bem registrado.</p>
            <div className="hp-site-hero__actions">
              <Link href="/signup" className="hp-site-btn-sand">Comece a certificar</Link>
              <a href="#verificar" className="hp-site-btn-paper">Verificar uma obra</a>
            </div>
          </div>
          {hero ? (
            <div className="hp-site-hero__figure">
              <Link href={`/e/artwork/${hero.publicId}`} className="hp-site-hero__frame" aria-label={`${hero.title}, de ${hero.artist}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                <img src={hero.cover} alt={`${hero.title}, de ${hero.artist}`} />
              </Link>
              <div className="hp-site-hero__caption">
                <span>{hero.artist} · <i>{hero.title}</i>{hero.year ? `, ${hero.year}` : ''}</span>
                <span className="hp-site-hero__verified"><Icon name="verified" size={14} filled />Autenticada</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="hp-site-pillars" aria-label="O que a HouseArt faz">
        {PILLARS.map((p) => (
          <div key={p.title} className="hp-site-pillar">
            <Icon name={p.icon} size={28} />
            <h2 className="hp-site-pillar__title">{p.title}</h2>
            <p>{p.text}</p>
          </div>
        ))}
      </section>

      <section className="hp-site-figures" aria-label="O mercado em números">
        <div className="hp-site-figures__grid">
          {FIGURES.map((f) => <div key={f.n} className="hp-site-figure"><div className="hp-site-figure__n">{f.n}</div><p>{f.text}</p></div>)}
        </div>
        <div className="hp-site-figures__sources">Fontes: Act Arte 2021–2025; Art Basel &amp; UBS 2026; Fine Art Expert Institute via Artnet.</div>
      </section>

      <section id="como" className="hp-site-how">
        <div className="hp-site-head">
          <div className="hp-site-head__eyebrow">Como funciona</div>
          <h2 className="hp-site-head__title">Encoste o celular. Veja a história inteira.</h2>
        </div>
        <div className="hp-site-steps">
          <div className="hp-site-step">
            <div className="hp-site-step__visual">
              {hero?.back ? (
                // eslint-disable-next-line @next/next/no-img-element -- derivada pública
                <img src={hero.back} alt="Verso de uma tela com o chassi aparente" />
              ) : null}
              <div className="hp-site-step__sticker" aria-hidden="true">HouseArt</div>
            </div>
            <StepText n={1} name={STEPS[0].name} desc={STEPS[0].desc} />
          </div>
          <div className="hp-site-step">
            <div className="hp-site-step__visual hp-site-step__visual--dark" aria-hidden="true">
              <div className="hp-site-ring"><span className="hp-site-ring__pulse" /><span className="hp-site-ring__pulse hp-site-ring__pulse--late" /><span className="hp-site-ring__core"><Icon name="contactless" size={40} /></span></div>
            </div>
            <StepText n={2} name={STEPS[1].name} desc={STEPS[1].desc} />
          </div>
          <div className="hp-site-step">
            <div className="hp-site-step__visual hp-site-step__visual--paper" aria-hidden="true">
              <div className="hp-site-phone">
                <div className="hp-site-phone__seal"><Icon name="verified" size={20} filled />Obra autenticada</div>
                <div className="hp-site-phone__wall">
                  {hero ? (
                    // eslint-disable-next-line @next/next/no-img-element -- derivada pública
                    <img src={hero.cover} alt="" />
                  ) : null}
                </div>
                <div className="hp-site-phone__meta">
                  <span className="hp-site-phone__artist">{hero?.artist ?? 'Artista'}</span>
                  <i className="hp-site-phone__title">{hero?.title ?? 'Título da obra'}</i>
                  <span className="hp-site-phone__id">{hero?.publicId ?? 'HA-0000-0000-0000'}</span>
                </div>
              </div>
            </div>
            <StepText n={3} name={STEPS[2].name} desc={STEPS[2].desc} />
          </div>
        </div>
      </section>

      <section id="para" className="hp-site-for">
        <div className="hp-site-for__inner">
          <SiteAudienceTabs images={audienceImages} />
        </div>
      </section>

      {plans.length > 0 ? (
        <section id="precos" className="hp-site-prices">
          <div className="hp-site-head">
            <div className="hp-site-head__eyebrow">Preços</div>
            <h2 className="hp-site-head__title">Certifique sem precisar vender aqui.</h2>
          </div>
          <div className="hp-site-prices__scroll">
            <div className="hp-site-prices__grid" style={{ gridTemplateColumns: `repeat(${plans.length}, minmax(200px, 1fr))` }}>
              {plans.map((p) => (
                <Link key={p.code} href={`/signup?plan=${p.code}`} className={`hp-site-plan${p.highlighted ? ' hp-site-plan--on' : ''}`}>
                  <div className="hp-site-plan__top">
                    <span className="hp-site-plan__audience">{PLAN_AUDIENCE_LABELS[p.audience]}</span>
                    {p.highlighted ? <span className="hp-site-plan__tag">Mais escolhido</span> : null}
                  </div>
                  <div className="hp-site-plan__head">
                    <span className="hp-site-plan__name">{p.name}</span>
                    <span className="hp-site-plan__price">{p.priceCents === 0n ? 'R$ 0' : priceLabel(p.priceCents)}{p.priceCents > 0n ? <span className="hp-site-plan__per">/mês</span> : null}</span>
                  </div>
                  <span className="hp-site-plan__desc">{p.description}</span>
                  <div className="hp-site-plan__items">
                    {p.features.map((f) => <div key={f} className="hp-site-plan__item"><Icon name="check" size={16} /><span>{f}</span></div>)}
                  </div>
                  <span className="hp-site-plan__cta">{planCtaLabel(p.name, p.priceCents)}<Icon name="arrow_forward" size={18} /></span>
                </Link>
              ))}
            </div>
          </div>
          {fees.length > 0 ? (
            <div className="hp-site-fees">
              <div className="hp-site-fees__head">
                <h3 className="hp-site-fees__title">Taxas avulsas</h3>
                <span className="hp-site-fees__note">Valem para qualquer plano. Cobradas só quando usadas.</span>
              </div>
              <div className="hp-site-fees__grid">
                {fees.map((g) => (
                  <div key={g.title} className="hp-site-fee">
                    <div className="hp-site-fee__head"><Icon name={g.icon} size={20} /><span className="hp-site-fee__title">{g.title}</span></div>
                    <div className="hp-site-fee__rows">
                      {g.items.map((it) => (
                        <div key={it.name} className="hp-site-fee__row">
                          <div className="hp-site-fee__k"><span className="hp-site-fee__name">{it.name}</span><span className="hp-site-fee__desc">{it.desc}</span></div>
                          <span className="hp-site-fee__v">{it.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null /* no active plan in the base: the "Preços" section stays hidden (never example prices). */}

      <section id="verificar" className="hp-site-verify">
        <div className="hp-site-verify__inner">
          <div className="hp-site-verify__copy">
            <h2 className="hp-site-verify__title">Verificar uma obra</h2>
            <p>Encoste o celular no verso da obra ou digite o ID impresso no certificado.</p>
          </div>
          <form className="hp-site-verify__form" action="/verify" method="get">
            <input name="id" className="hp-site-verify__input" placeholder="HA-0000-0000-0000" aria-label="ID da obra" autoComplete="off" spellCheck={false} />
            <button type="submit" className="hp-site-verify__btn">Verificar</button>
          </form>
        </div>
      </section>

      {users.length > 0 ? (
        <section id="sobre" className="hp-site-who">
          <h2 className="hp-section-title">Quem já usa</h2>
          <div className="hp-site-who__grid">
            {users.map((u) => (
              <Link key={u.href} href={u.href} className="hp-site-who__card">
                <Icon name="format_quote" size={24} />
                <span className="hp-site-who__name">{u.name}</span>
                <span className="hp-site-who__meta">{u.meta}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
