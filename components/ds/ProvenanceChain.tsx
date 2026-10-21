// provenance-chain (molécula): evento · parte · data, com trilho de 1px entre os pontos.
import { Icon } from './Icon'

export interface ProvenanceEvent { icon: string; event: string; party: string; date: string }

export function ProvenanceChain({ events }: { events: ProvenanceEvent[] }) {
  return (
    <ol className="ha-prov" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {events.map((e, i) => (
        <li key={i} className="ha-prov__row">
          <span className="ha-prov__rail"><span className="ha-prov__dot"><Icon name={e.icon} size={18} /></span><span className="ha-prov__line" /></span>
          <span className="ha-prov__body"><span className="ha-prov__event" style={{ display: 'block' }}>{e.event}</span><span className="ha-prov__party">{e.party}</span></span>
          <span className="ha-prov__date">{e.date}</span>
        </li>
      ))}
    </ol>
  )
}
