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
import { Badge } from '@/components/ds/Badge'
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
  const read = sp.uid ? await recordPublicRead(publicId, { uid: sp.uid, ctr: Number(sp.ctr ?? sp.c ?? -1), cmac: sp.cmac ?? sp.m ?? '', tt: sp.tt === '1' }, ipHashOf(rawIpFromHeaders(h))) : null
  return <Verification c={c} read={read ? { authenticated: read.authenticated, tamper: read.tamper } : null} />
}

async function AppraisalVerify({ code }: { code: string }) {
  const a = await publicAppraisal(code)
  if (!a) notFound()
  return (
    <div className="ha-page ha-page--loose" style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--ha-space-12) var(--ha-space-6)' }}>
      <p className="ha-eyebrow">Verificação pública · laudo de opinião de valor</p>
      <h1 className="ha-h1">{a.code}</h1>
      <div className="ha-row"><Badge tone={a.status === 'ISSUED' ? 'verified' : 'neutral'}>{a.status === 'ISSUED' ? 'Laudo vigente' : 'Laudo substituído'}</Badge></div>
      <section className="ha-deed">
        <div className="ha-kv">
          <span>Obra</span><span>{a.artwork.title}{a.artwork.year ? `, ${a.artwork.year}` : ''}</span>
          <span>Artista</span><span>{a.artwork.artist}</span>
          <span>Técnica</span><span>{a.artwork.technique ?? '—'}</span>
          <span>Dimensões</span><span>{a.artwork.dimensions}</span>
          <span>Finalidade</span><span>{a.purpose}</span>
          <span>Faixa</span><span className="ha-num">{formatBRL(BigInt(a.minCents))} — <b>{formatBRL(BigInt(a.suggestedCents))}</b> — {formatBRL(BigInt(a.maxCents))}</span>
          <span>Avaliador</span><span>{a.appraiser}</span>
          <span>Emitido em</span><span>{new Date(a.issuedAt).toLocaleDateString('pt-BR')}</span>
          <span>Hash do conteúdo</span><span className="ha-sm" style={{ wordBreak: 'break-all' }}>{a.contentHash}</span>
          {a.artwork.publicId ? <><span>Certificado</span><span><a className="ha-link" href={`/verify/${a.artwork.publicId}`}>{a.artwork.publicId}</a></span></> : null}
        </div>
      </section>
      <p className="ha-muted ha-sm">Opinião de valor para a finalidade declarada. Não substitui laudo pericial nem avaliação judicial.</p>
    </div>
  )
}
