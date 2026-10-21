'use client'
// The simulated reading of the tag when the page opens by tap (?uid present):
// "Lendo a etiqueta" for ~600 ms, then the verdict of the server (valid / removed).
import { useEffect, useState } from 'react'
import { TagReader, type ReaderState } from '@/components/ds/TagReader'

export type ReadResult = 'valid' | 'tamper' | 'unverified'

export function VerificationReader({ result, verdict }: { result: ReadResult; verdict: 'authenticated' | 'contested' | 'stolen' }) {
  const [state, setState] = useState<ReaderState>('reading')
  useEffect(() => {
    const t = window.setTimeout(() => setState(result === 'valid' ? 'valid' : 'removed'), 600)
    return () => window.clearTimeout(t)
  }, [result])
  const title = state === 'reading' ? 'Lendo a etiqueta' : state === 'valid' ? (verdict === 'authenticated' ? 'Etiqueta válida' : 'Atenção') : 'Etiqueta não confirmada'
  const sub = state === 'reading' ? 'Mantenha o celular encostado no verso da obra' : state === 'valid' ? 'Etiqueta conferida com o certificado registrado' : result === 'tamper' ? 'A leitura indicou violação ou remoção do chip. Fale com o suporte.' : 'Não foi possível conferir a etiqueta com este certificado. Aproxime o celular de novo.'
  return <div className="hp-verification-reader"><TagReader state={state} title={title} subtitle={sub} /></div>
}
