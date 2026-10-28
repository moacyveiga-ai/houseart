// /verify/[publicId] — Verificação pública of a certificate (HA-AAAA-XXXX-XXXX) or of a
// value opinion (HA-L-AAAA-XXXX). Opened by tap (?uid&ctr&cmac[&tt]) the SUN read is
// recorded first; the page then shows the reading overlay. The certificate card is the
// page (handoff "HouseArt Verificacao": header of its own, no site nav or footer — it is
// the screen the tap opens); the value opinion keeps the public shell.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import '@/app/ds/public.css'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { publicAccount } from '@/app/e/_shared/public-account'
import { Verification } from '@/components/public/Verification'
import { Icon } from '@/components/ds/Icon'
import { dataBR } from '@/lib/timezone'
import '@/components/public/verification.css'
import { isPublicId } from '@/lib/physical-markers/domain'
import { publicCertificate } from '@/lib/certificates/server'
import { recordPublicRead, ipHashOf } from '@/lib/physical-markers/server'
import { rawIpFromHeaders } from '@/lib/http/ip'
import { isAppraisalCode } from '@/lib/appraisal/domain'
import { publicAppraisal } from '@/lib/appraisal/server'
import { formatBRL } from '@/lib/artworks/domain'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ publicId: string }>; searchParams: Promise<Record<string, string | undefined>> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const publicId = (await params).publicId.toUpperCase()
  return {
    title: `Verificação ${publicId} — HouseArt`,
    description: 'Verificação pública de um certificado-escritura HouseArt: autenticidade, etiqueta e cadeia de titularidade da obra.',
  }
}

export default async function VerifyPage({ params, searchParams }: Params) {
  const publicId = (await params).publicId.toUpperCase()
  if (!isAppraisalCode(publicId)) return <main className="hp"><CertificateVerify publicId={publicId} sp={await searchParams} /></main>
  return (
    <div className="hp">
      <PublicHeader account={await publicAccount()} />
      <main><AppraisalVerify code={publicId} /></main>
      <PublicFooter />
    </div>
  )
}

async function CertificateVerify({ publicId, sp }: { publicId: string; sp: Record<string, string | undefined> }) {
  if (!isPublicId(publicId)) notFound()
  const c = await publicCertificate(publicId)
  if (!c) notFound()
  const h = await headers()
  const read = sp.uid ? await recordPublicRead(publicId, { uid: sp.uid, ctr: Number(sp.ctr ?? sp.c ?? -1), cmac: sp.cmac ?? sp.m ?? '', tt: sp.tt?.slice(0, 8) }, ipHashOf(rawIpFromHeaders(h))) : null
  return <Verification c={c} read={read ? { authenticated: read.authenticated, tamper: read.tamper } : null} />
}

async function AppraisalVerify({ code }: { code: string }) {
  const a = await publicAppraisal(code)
  if (!a) notFound()
  const current = a.status === 'ISSUED'
  // the same card as the certificate's verification (audit público: the laudo was in the old look)
  return (
    <div className="hp-verification hp-verification--embedded">
      <article className="hp-verification__card">
        <header className="hp-verification__top"><span>Verificação pública · laudo de opinião de valor</span></header>
        <div className={`hp-verification-banner${current ? ' hp-verification-banner--authenticated' : ''}`}>
          <Icon name={current ? 'verified' : 'history'} size={36} filled />
          <div><h2>{current ? 'Laudo vigente' : 'Laudo substituído'}</h2><p>{current ? 'Emitido e assinado pela HouseArt. O conteúdo abaixo confere com o código.' : 'Existe um laudo mais novo para esta obra.'}</p></div>
        </div>
        <div className="hp-verification-title">
          <span className="hp-verification-title__artist">{a.artwork.artist}</span>
          <h1>{a.artwork.title}{a.artwork.year ? <>, <span>{a.artwork.year}</span></> : null}</h1>
          <div className="hp-verification-title__meta">{[a.artwork.technique, a.artwork.dimensions].filter(Boolean).join(' · ')}</div>
        </div>
        <dl className="hp-verification-kv">
          <div className="hp-verification-kv__row"><dt>Código do laudo</dt><dd>{a.code}</dd></div>
          <div className="hp-verification-kv__row"><dt>Finalidade</dt><dd>{a.purpose}</dd></div>
          <div className="hp-verification-kv__row"><dt>Faixa de valor</dt><dd className="ha-num">{formatBRL(BigInt(a.minCents))} — <b>{formatBRL(BigInt(a.suggestedCents))}</b> — {formatBRL(BigInt(a.maxCents))}</dd></div>
          <div className="hp-verification-kv__row"><dt>Avaliador</dt><dd>{a.appraiser}</dd></div>
          <div className="hp-verification-kv__row"><dt>Emitido em</dt><dd>{dataBR(a.issuedAt)}</dd></div>
          <div className="hp-verification-kv__row"><dt>Hash do conteúdo</dt><dd style={{ wordBreak: 'break-all' }}>{a.contentHash}</dd></div>
          {a.artwork.publicId ? <div className="hp-verification-kv__row"><dt>Certificado</dt><dd><a className="ha-link" href={`/verify/${a.artwork.publicId}`}>{a.artwork.publicId}</a></dd></div> : null}
        </dl>
        <div className="hp-verification-note"><Icon name="info" size={18} />Opinião de valor para a finalidade declarada. Não substitui laudo pericial nem avaliação judicial.</div>
      </article>
    </div>
  )
}
