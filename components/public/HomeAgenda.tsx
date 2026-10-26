'use client'
// Agenda of the Home (HouseArt Home.dc.html › Home · Agenda): kind chips,
// month tabs and the list, filtered in local state over the events the server
// loaded. "Salvar" is the SAVE reaction on the event (shows in the Comunidade › Salvos).
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { PublicReactButton } from './PublicReactButton'
import { AGENDA_FILTERS, AGENDA_KIND_STYLE, dayPartsOf, filterAgenda, initialMonth, isAgendaKind, type MonthTab } from '@/lib/public-content/home-core'
import { AGENDA_KIND_LABELS, type AgendaKind } from '@/lib/public-content/domain'

export interface HomeAgendaEvent { id: number; kind: string; title: string; venue: string; city: string; startsOn: string; period: string | null }

export function HomeAgenda({ tabs, events, savedIds = [], signedIn = false }: { tabs: MonthTab[]; events: HomeAgendaEvent[]; savedIds?: number[]; signedIn?: boolean }) {
  const [month, setMonth] = useState(() => initialMonth(tabs, events))
  const [kind, setKind] = useState<AgendaKind | null>(null)
  const shown = filterAgenda(events, month, kind)
  return (
    <section id="agenda" className="hp-home-agenda">
      <div className="hp-container hp-home-agenda__inner">
        <div className="hp-home-agenda__head">
          <div className="hp-home-agenda__title">
            <h2 className="hp-section-title">Agenda de arte no Brasil</h2>
            <span className="hp-home-agenda__sub">Feiras, exposições, aberturas e leilões.</span>
          </div>
          <div className="hp-home-agenda__chips" role="group" aria-label="Tipo de evento">
            {AGENDA_FILTERS.map((f) => (
              <button key={f.label} type="button" className={`hp-chip${kind === f.key ? ' hp-chip--on' : ''}`} aria-pressed={kind === f.key} onClick={() => setKind(f.key)}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="hp-home-agenda__months" role="tablist" aria-label="Mês">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={month === t.key} className={`hp-home-agenda__month${month === t.key ? ' hp-home-agenda__month--on' : ''}`} onClick={() => setMonth(t.key)}>{t.label}</button>
          ))}
        </div>
        <div className="hp-home-agenda__list">
          {shown.map((e) => {
            const { day, mon } = dayPartsOf(e.startsOn)
            const style = isAgendaKind(e.kind) ? AGENDA_KIND_STYLE[e.kind] : AGENDA_KIND_STYLE.EXHIBITION
            const label = isAgendaKind(e.kind) ? AGENDA_KIND_LABELS[e.kind] : e.kind
            return (
              <div key={e.id} className="hp-home-event">
                <div className="hp-home-event__date"><span className="hp-home-event__day">{day}</span><span className="hp-home-event__mon">{mon}</span></div>
                <div className="hp-home-event__body">
                  <div className="hp-home-event__meta"><span className="hp-home-event__kind" style={{ background: style.bg, color: style.fg }}>{label}</span>{e.period ? <span className="hp-home-event__period">{e.period}</span> : null}</div>
                  <span className="hp-home-event__title">{e.title}</span>
                  <span className="hp-home-event__place"><Icon name="location_on" size={16} />{e.venue} · {e.city}</span>
                </div>
                <PublicReactButton target="EVENT" targetId={e.id} kind="SAVE" on={savedIds.includes(e.id)} signedIn={signedIn} className="hp-home-event__save" onClass="hp-home-event__save--on"
                  onChildren={<><Icon name="event_available" size={18} />Salvo</>}><Icon name="event" size={18} />Salvar</PublicReactButton>
              </div>
            )
          })}
          {shown.length === 0 ? <div className="hp-empty">Nenhum evento desse tipo neste mês.</div> : null}
        </div>
      </div>
    </section>
  )
}
