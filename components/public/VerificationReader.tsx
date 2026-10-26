'use client'
// The tag-reading overlay of the public verification opened by tap (?uid present):
// full card, ink-900 — "Lendo a etiqueta" (two pulsing rings, 1,6 s) → the verdict
// (ring closes around the icon, 0,9 s) → the overlay goes away and the page shows.
// The verdict itself lives in the page (banner, "Etiqueta de autenticação" line):
// the overlay only tells it once. Rules in verification-reader-core.ts.
import { useEffect, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { outcomeIcon, outcomeOf, readerSubtitle, readerTitle, READING_MS, RESULT_MS, type ReaderPhase, type ReadResult, type Verdict } from './verification-reader-core'

export type { ReadResult } from './verification-reader-core'

export function VerificationReader({ result, verdict }: { result: ReadResult; verdict: Verdict }) {
  const [phase, setPhase] = useState<ReaderPhase>('reading')
  useEffect(() => {
    const a = window.setTimeout(() => setPhase('result'), READING_MS)
    const b = window.setTimeout(() => setPhase('done'), READING_MS + RESULT_MS)
    return () => { window.clearTimeout(a); window.clearTimeout(b) }
  }, [result, verdict])
  if (phase === 'done') return null
  const outcome = outcomeOf(result, verdict)
  const showing = phase === 'result'
  return (
    <div className="hp-verification-overlay" role="status" aria-live="polite">
      <div className={`hp-verification-overlay__ring${showing ? ` hp-verification-overlay__ring--${outcome}` : ''}`}>
        {showing ? (
          <svg width="140" height="140" viewBox="0 0 104 104" className="hp-verification-overlay__close" aria-hidden="true"><circle cx="52" cy="52" r="48" fill="none" strokeWidth="4" strokeDasharray="302" /></svg>
        ) : (
          <><span className="hp-verification-overlay__pulse" /><span className="hp-verification-overlay__pulse hp-verification-overlay__pulse--late" /></>
        )}
        <span className="hp-verification-overlay__core"><Icon name={showing ? outcomeIcon(outcome) : 'contactless'} size={40} /></span>
      </div>
      <div>
        <div className="hp-verification-overlay__title">{readerTitle(phase, result, verdict)}</div>
        <div className="hp-verification-overlay__sub">{readerSubtitle(phase, result)}</div>
      </div>
    </div>
  )
}
