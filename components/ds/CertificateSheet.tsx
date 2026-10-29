// certificate-sheet (organismo): a folha do certificado de autenticidade e titularidade.
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'

export interface CertificateData {
  number: string
  src: string | null
  work: string
  artist: string
  technique: string
  holder: string
  marker: string
  signedBy: string
  timestamp: string
  holders: string
}

export function CertificateSheet({ c }: { c: CertificateData }) {
  return (
    <article className="ha-cert">
      <div className="ha-cert__head">
        <HouseArtLogo version="full_horiz" tone="auto" height={26} />
        <div className="ha-cert__num"><div className="ha-cert__num-label">Certificado nº</div><div className="ha-id">{c.number}</div></div>
      </div>
      <div className="ha-cert__title">Certificado de autenticidade e titularidade</div>
      <div className="ha-cert__body">
        <div className="ha-cert__thumb">
          {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
          {c.src ? <img src={c.src} alt="" /> : null}
        </div>
        <dl className="ha-cert__kv">
          <dt>Obra</dt><dd className="ha-cert__work">{c.work}</dd>
          <dt>Artista</dt><dd>{c.artist}</dd>
          <dt>Técnica</dt><dd>{c.technique}</dd>
          <dt>Titular</dt><dd>{c.holder}</dd>
          <dt>Etiqueta</dt><dd>{c.marker}</dd>
        </dl>
      </div>
      <div className="ha-cert__foot">
        <div className="ha-cert__meta">
          <span><b>Assinado</b> {c.signedBy}</span>
          <span>{c.timestamp}</span>
          <span>{c.holders}</span>
        </div>
        <span className="ha-cert__qr" aria-hidden="true" />
      </div>
    </article>
  )
}
