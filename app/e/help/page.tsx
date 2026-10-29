import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { HELP_ARTICLES } from '@/components/public/help-content'
import { readMinutesLabel } from '@/components/public/reading-core'
import '@/components/public/news.css'

export const metadata: Metadata = { title: 'Ajuda — HouseArt', description: 'Certificado, propostas, pagamento em garantia, recebimentos, transferência e etiqueta NFC: as respostas da HouseArt.' }

// Central de Ajuda: the index of the short articles (components/public/help-content.ts), in the look of the news list.
export default function HelpPage() {
  const support = process.env.SUPPORT_EMAIL?.trim()
  return (
    <section className="hp-container hp-news" aria-labelledby="help-title">
      <div className="hp-news__head">
        <span className="hp-eyebrow">Ajuda</span>
        <h1 id="help-title" className="hp-section-title">Como podemos ajudar?</h1>
        <p className="hp-news__sub">Respostas curtas sobre o certificado, as propostas, o pagamento em garantia e a etiqueta da obra.</p>
      </div>
      <div className="hp-help__list">
        {HELP_ARTICLES.map((a) => (
          <Link key={a.slug} href={`/e/help/${a.slug}`} className="hp-news__guide">
            <Icon name={a.icon} size={26} />
            <span className="hp-news__guide-t"><span className="hp-news__guide-k">{readMinutesLabel(a.readMinutes)}</span><span className="hp-news__guide-n">{a.title}</span></span>
            <Icon name="arrow_forward" size={22} />
          </Link>
        ))}
      </div>
      <p className="hp-news__sub">Não achou? {support ? <a href={`mailto:${support}?subject=${encodeURIComponent('Ajuda — HouseArt')}`}>Fale com a HouseArt</a> : <Link href="/e/how-it-works#suporte">Fale com a HouseArt</Link>}.</p>
    </section>
  )
}
