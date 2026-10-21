import { notFound } from 'next/navigation'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { Badge } from '@/components/ds/Badge'
import { Icon } from '@/components/ds/Icon'
import { isPublicId } from '@/lib/physical-markers/domain'
import { publicCertificate } from '@/lib/certificates/server'
import { recordPublicRead, ipHashOf } from '@/lib/physical-markers/server'
import { headers } from 'next/headers'
import { rawIpFromHeaders } from '@/lib/http/ip'
import { isAppraisalCode } from '@/lib/appraisal/domain'
import { publicAppraisal } from '@/lib/appraisal/server'
import { formatBRL } from '@/lib/artworks/domain'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { label: string; tone: 'verified' | 'pending' | 'alert' | 'neutral' }> = {
  ACTIVE: { label: 'Certificado ativo', tone: 'verified' }, PENDING: { label: 'Em certificação', tone: 'pending' },
  CONTESTED: { label: 'Contestado', tone: 'alert' }, REVOKED: { label: 'Revogado', tone: 'alert' },
}

export default async function VerifyPage({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const publicId = (await params).publicId.toUpperCase()
  if (isAppraisalCode(publicId)) return <AppraisalVerify code={publicId} />
  if (!isPublicId(publicId)) notFound()
  const sp = await searchParams
  const c = await publicCertificate(publicId)
  if (!c) notFound()
  const h = await headers()
  const read = sp.uid ? await recordPublicRead(publicId, { uid: sp.uid, ctr: Number(sp.ctr ?? sp.c ?? -1), cmac: sp.cmac ?? sp.m ?? '', tt: sp.tt === '1' }, ipHashOf(rawIpFromHeaders(h))) : null
  const st = STATUS[c.status] ?? STATUS.PENDING
  return (
    <main className="ha-page ha-page--loose" style={{ maxWidth: 720, margin: '0 auto' }}>
      <HouseArtLogo size={24} />
      <p className="ha-eyebrow">Verificação pública</p>
      <h1 className="ha-h1">{c.publicId}</h1>
      <div className="ha-row"><Badge tone={st.tone}>{st.label}</Badge>
        {read ? <Badge tone={read.authenticated ? 'verified' : 'pending'}><Icon name="contactless" size={14} /> {read.authenticated ? 'Leitura autenticada pela etiqueta' : 'Leitura não autenticada'}</Badge> : <Badge tone="neutral">Leitura não autenticada (sem etiqueta)</Badge>}
        {read?.tamper ? <Badge tone="alert">Etiqueta violada</Badge> : null}
        {c.artworkStatus === 'STOLEN' ? <Badge tone="alert">Comunicada como roubada</Badge> : null}
      </div>
      <section className="ha-deed">
        <div className="ha-wall ha-wall--sq" style={{ maxWidth: 320 }}>{/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
        {c.artwork.cover ? <img src={c.artwork.cover} alt={c.artwork.title} /> : null}</div>
        <div className="ha-kv">
          <span>Obra</span><span>{c.artwork.title}{c.artwork.year ? `, ${c.artwork.year}` : ''}</span>
          <span>Artista</span><span>{c.artist}</span>
          <span>Técnica</span><span>{c.artwork.technique ?? '—'}</span>
          <span>Dimensões</span><span>{c.artwork.dimensions}</span>
          <span>Titular</span><span>{c.holder ?? '—'}</span>
          <span>Emitido em</span><span>{c.issuedAt ? new Date(c.issuedAt).toLocaleDateString('pt-BR') : '—'}</span>
          <span>Hash da versão {c.version ?? ''}</span><span className="ha-sm" style={{ wordBreak: 'break-all' }}>{c.contentHash ?? '—'}</span>
          <span>Cadeia</span><span>{c.chainValid ? 'íntegra' : 'INVÁLIDA'}</span>
        </div>
      </section>
      <h2 className="ha-h3">Cadeia de titularidade</h2>
      <ul className="ha-list">
        {c.events.length === 0 ? <li className="ha-muted">Nenhum evento registrado.</li> : null}
        {c.events.map((e) => <li key={e.seq} className="ha-list__row" style={{ gridTemplateColumns: '40px 1fr auto' }}><span className="ha-muted">#{e.seq}</span><span>{e.label}</span><span className="ha-muted ha-sm">{new Date(e.at).toLocaleDateString('pt-BR')}</span></li>)}
      </ul>
      <p className="ha-muted ha-sm">Esta página não mostra valores nem documentos. Para contestar a titularidade, use a API pública de contestação ou escreva para a equipe HouseArt.</p>
    </main>
  )
}

async function AppraisalVerify({ code }: { code: string }) {
  const a = await publicAppraisal(code)
  if (!a) notFound()
  return (
    <main className="ha-page ha-page--loose" style={{ maxWidth: 720, margin: '0 auto' }}>
      <HouseArtLogo size={24} />
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
    </main>
  )
}
