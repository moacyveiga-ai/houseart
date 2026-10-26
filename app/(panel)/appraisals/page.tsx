import { notFound } from 'next/navigation'
import { requirePanelPage } from '../_session'
import { appraisalDossier, appraisalQueue, appraisersList } from '@/lib/appraisal/server'
import { canManage, DESK_FILTER_LABELS, DESK_FILTERS, filterKey, kpisOf, matchesFilter } from '@/lib/appraisal/desk-core'
import { AppraisalDesk } from '@/components/appraisal/AppraisalDesk'
import { Kpis } from '@/components/ds/Kpi'
import { flagOn } from '@/lib/flags'
import { hasTotalScope } from '@/lib/auth/profiles'
import '@/components/appraisal/appraisal-desk.css'

export const metadata = { title: 'Laudo de opinião de valor — HouseArt' }

/** The appraiser's desk and, for the team, the queue it assigns and follows (audit 2026-10-25 §5). */
export default async function AppraisalsPage({ searchParams }: { searchParams: Promise<{ pedido?: string; f?: string }> }) {
  if (!flagOn('FLAG_APPRAISAL')) notFound()
  const { user } = await requirePanelPage('/appraisals')
  if (user.profile !== 'appraiser' && !hasTotalScope(user)) notFound()
  const sp = await searchParams
  const actor = { userId: user.id, profile: user.profile }
  const manage = canManage(actor)
  const now = new Date()
  const f = filterKey(sp.f)
  const all = await appraisalQueue(now, { all: true })
  const queue = all.filter((q) => matchesFilter({ ...q, dueOn: q.dueOnIso }, f, user.id, now))
  const wanted = Number(sp.pedido ?? '')
  const selectedId = all.some((q) => q.id === wanted) ? wanted : queue[0]?.id ?? null
  const [dossier, appraisers] = await Promise.all([selectedId ? appraisalDossier(selectedId) : null, manage ? appraisersList() : []])
  const k = kpisOf(all.map((q) => ({ ...q, dueOn: q.dueOnIso })), now)
  return (
    <div className="ha-page">
      {manage ? (
        <>
          <div className="ha-page__head"><h1 className="ha-h1">Laudos</h1></div>
          <Kpis items={[
            { label: 'Abertos', value: String(k.open), note: k.unassigned ? `${k.unassigned} sem avaliador` : 'todos com avaliador' },
            { label: 'Atrasados', value: String(k.overdue), note: k.dueSoon ? `${k.dueSoon} ${k.dueSoon === 1 ? 'vence' : 'vencem'} até amanhã` : 'nenhum vence até amanhã' },
            { label: 'Emitidos', value: String(k.issued), note: 'laudos assinados' },
            { label: 'Avaliadores', value: String(appraisers.length), note: appraisers.length ? `${appraisers.filter((a) => a.open).length} com pedido aberto` : 'nenhum avaliador ativo' },
          ]} />
        </>
      ) : null}
      <AppraisalDesk
        queue={queue} dossier={dossier} selected={all.find((q) => q.id === selectedId) ?? null}
        actor={actor} manage={manage} appraisers={appraisers} filter={f}
        filters={DESK_FILTERS.filter((key) => manage || key !== 'cancelled').map((key) => ({ key, label: DESK_FILTER_LABELS[key], count: all.filter((q) => matchesFilter({ ...q, dueOn: q.dueOnIso }, key, user.id, now)).length }))}
      />
    </div>
  )
}
