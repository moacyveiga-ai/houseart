// Verificar (handoff "HouseArt Verificar"): the public, free search of a certificate —
// by number (or marker serial) or by artist / title / year. The form is a plain GET:
// the page reads the URL and the server searches; no island is needed.
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import type { CertificateSearchHit, VerificationVerdict } from '@/lib/certificates/server'
import './verify.css'

export type VerifyMode = 'id' | 'nome'
export interface VerifyQuery { modo: VerifyMode; id: string; artista: string; titulo: string; ano: string }

const MODES: { key: VerifyMode; label: string; icon: string }[] = [
  { key: 'id', label: 'Número do certificado', icon: 'tag' },
  { key: 'nome', label: 'Artista e nome da obra', icon: 'person_search' },
]

const VERDICT: Record<VerificationVerdict, { label: string; icon: string }> = {
  authenticated: { label: 'Autenticada', icon: 'verified' },
  contested: { label: 'Contestada', icon: 'report' },
  stolen: { label: 'Registrada como roubada', icon: 'gpp_bad' },
}

export function Verify({ q, searched, results }: { q: VerifyQuery; searched: boolean; results: CertificateSearchHit[] }) {
  const byId = q.modo === 'id'
  return (
    <>
      <section className="hp-verify-hero">
        <div className="hp-verify-hero__inner">
          <div className="hp-verify-head">
            <span className="hp-verify-head__eyebrow"><Icon name="verified" size={18} />Consulta pública e gratuita</span>
            <h1>Verificar uma obra</h1>
            <p>Confira se a obra tem certificado HouseArt, quem é o titular registrado e se há alguma contestação.</p>
          </div>

          <div className="hp-verify-box">
            <nav className="hp-verify-modes" aria-label="Modo de busca">
              {MODES.map((m) => (
                <Link key={m.key} href={`/verify?modo=${m.key}`} className={`hp-verify-mode${q.modo === m.key ? ' hp-verify-mode--on' : ''}`} aria-current={q.modo === m.key ? 'page' : undefined}>
                  <Icon name={m.icon} size={20} />{m.label}
                </Link>
              ))}
            </nav>
            <form method="get" action="/verify" className="hp-verify-form">
              <input type="hidden" name="modo" value={q.modo} />
              {byId ? (
                <label className="hp-verify-label">Número do certificado
                  <input name="id" defaultValue={q.id} className="hp-verify-input hp-verify-input--id" placeholder="HA-2026-0000-0000" aria-label="Número do certificado" autoCapitalize="characters" autoComplete="off" />
                  <small>Impresso no certificado e na etiqueta do verso. Também aceita o número de série da etiqueta.</small>
                </label>
              ) : (
                <div className="hp-verify-fields">
                  <label className="hp-verify-label">Artista
                    <input name="artista" defaultValue={q.artista} className="hp-verify-input" placeholder="Nome ou nome artístico" />
                  </label>
                  <label className="hp-verify-label">Nome da obra
                    <input name="titulo" defaultValue={q.titulo} className="hp-verify-input" placeholder="Título, mesmo que parcial" />
                  </label>
                  <label className="hp-verify-label">Ano
                    <input name="ano" defaultValue={q.ano} className="hp-verify-input" placeholder="Opcional" inputMode="numeric" />
                  </label>
                </div>
              )}
              <div className="hp-verify-actions">
                <span className="hp-verify-hint"><Icon name="contactless" size={18} />Tem a obra em mãos? Encoste o celular na etiqueta do verso.</span>
                <button type="submit" className="hp-verify-submit"><Icon name="search" size={20} />Verificar</button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="hp-verify-results">
        {searched ? (
          <>
            <div className="hp-verify-results__head">
              <h2>{results.length === 1 ? '1 obra encontrada' : `${results.length} obras encontradas`}</h2>
              <Link href={`/verify?modo=${q.modo}`} className="hp-verify-new">Nova busca</Link>
            </div>
            {results.length > 0 ? (
              <div className="hp-verify-list">
                {results.map((r) => {
                  const v = VERDICT[r.verdict]
                  return (
                    <Link key={r.publicId} href={`/verify/${r.publicId}`} className="hp-verify-row">
                      <div className="hp-verify-row__thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                        {r.cover ? <img src={r.cover} alt="" /> : null}
                      </div>
                      <div className="hp-verify-row__text">
                        <span className="hp-verify-row__title">{r.title}{r.year ? `, ${r.year}` : ''}</span>
                        <span className="hp-verify-row__artist">{r.artist}</span>
                        <span className="hp-verify-row__meta">{r.publicId}{r.technique ? ` · ${r.technique}` : ''}</span>
                      </div>
                      <div className="hp-verify-row__side">
                        <span className={`hp-verify-pill hp-verify-pill--${r.verdict}`}><Icon name={v.icon} size={16} filled />{v.label}</span>
                        <span className="hp-verify-row__go">Ver certificado<Icon name="chevron_right" size={16} /></span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="hp-verify-empty">
                <Icon name="search_off" size={28} />
                <div className="hp-verify-empty__text">
                  <b>Nenhuma obra certificada encontrada</b>
                  <span>Isso não quer dizer que a obra seja falsa, só que ela não tem certificado HouseArt. Confira se o número foi digitado corretamente ou peça ao vendedor o certificado original.</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="hp-verify-help">
            <div className="hp-verify-help__item"><Icon name="tag" size={28} /><b>Onde está o número</b><span>No certificado impresso e na etiqueta colada no verso da obra, no formato HA-ano-0000-0000.</span></div>
            <div className="hp-verify-help__item"><Icon name="person_search" size={28} /><b>Sem o número?</b><span>Busque pelo artista e pelo nome da obra. Compare a imagem e as medidas antes de confiar no resultado.</span></div>
            <div className="hp-verify-help__item"><Icon name="shield" size={28} /><b>O que você vê</b><span>Situação do certificado, artista, titular atual (anônimo, se for particular) e alertas de contestação ou roubo.</span></div>
          </div>
        )}
      </section>
    </>
  )
}
