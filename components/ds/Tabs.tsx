import Link from 'next/link'

export interface TabItem { key: string; label: string; href: string; count?: number }

export function Tabs({ items, active }: { items: readonly TabItem[]; active: string }) {
  return (
    <nav className="ha-tabs" aria-label="Abas">
      {items.map((t) => (
        <Link key={t.key} href={t.href} className={`ha-tab${t.key === active ? ' ha-tab--on' : ''}`} aria-current={t.key === active ? 'page' : undefined}>
          {t.label}{typeof t.count === 'number' ? <span className="ha-chip__n"> {t.count}</span> : null}
        </Link>
      ))}
    </nav>
  )
}
