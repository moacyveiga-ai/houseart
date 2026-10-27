import Link from 'next/link'
import { Icon } from './Icon'

/** `locked`: the tab opens read-only for this viewer (a lock after the label, as the design shows). */
export interface TabItem { key: string; label: string; href: string; count?: number; locked?: boolean }

export function Tabs({ items, active }: { items: readonly TabItem[]; active: string }) {
  return (
    <nav className="ha-tabs" aria-label="Abas">
      {items.map((t) => (
        <Link key={t.key} href={t.href} className={`ha-tab${t.key === active ? ' ha-tab--on' : ''}`} aria-current={t.key === active ? 'page' : undefined}>
          {t.label}{t.locked ? <Icon name="lock" size={14} label="somente leitura" /> : null}{typeof t.count === 'number' ? <span className="ha-chip__n"> {t.count}</span> : null}
        </Link>
      ))}
    </nav>
  )
}
