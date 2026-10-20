import { Icon } from './Icon'

export interface TimelineStep { title: string; detail: string; when: string; icon: string }

export function Timeline({ steps, current }: { steps: readonly TimelineStep[]; current: number }) {
  return (
    <ol className="ha-timeline">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'on' : 'todo'
        return (
          <li key={s.title} className={`ha-timeline__item ha-timeline__item--${state}${i === steps.length - 1 ? ' ha-timeline__item--last' : ''}`}>
            <span className="ha-timeline__rail"><span className="ha-timeline__dot"><Icon name={s.icon} size={18} /></span><span className="ha-timeline__line" /></span>
            <div className="ha-timeline__body">
              <div className="ha-timeline__name">{s.title}</div>
              <div className="ha-timeline__desc">{s.detail}</div>
            </div>
            <div className="ha-timeline__date">{s.when}</div>
          </li>
        )
      })}
    </ol>
  )
}
