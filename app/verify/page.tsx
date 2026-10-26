// /verify — Verificar: the public search of a certificate (outside /e, so the
// public shell is rendered here). The form is a GET: ?modo=id&id=… or
// ?modo=nome&artista=&titulo=&ano=; a bare ?id=HA-… from the institutional site also works.
import type { Metadata } from 'next'
import '@/app/ds/public.css'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { publicAccount } from '@/app/e/_shared/public-account'
import { Verify, type VerifyQuery } from '@/components/public/Verify'
import { searchCertificates } from '@/lib/certificates/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Verificar uma obra — HouseArt', description: 'Consulta pública e gratuita: confira se a obra tem certificado HouseArt, quem é o titular registrado e se há alguma contestação.' }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const q: VerifyQuery = { modo: one(sp.modo) === 'nome' ? 'nome' : 'id', id: one(sp.id).toUpperCase().trim(), artista: one(sp.artista).trim(), titulo: one(sp.titulo).trim(), ano: one(sp.ano).trim() }
  const searched = q.modo === 'id' ? q.id !== '' : q.artista !== '' || q.titulo !== '' || q.ano !== ''
  const results = searched ? await searchCertificates(q.modo === 'id' ? { id: q.id } : { artist: q.artista, title: q.titulo, year: q.ano }) : []
  return (
    <div className="hp">
      <PublicHeader account={await publicAccount()} />
      <main><Verify q={q} searched={searched} results={results} /></main>
      <PublicFooter />
    </div>
  )
}
