import type { CSSProperties, ReactNode } from 'react'

/** Grid table of the design: `cols` is the CSS grid-template-columns (e.g. '2fr 1fr 1fr 120px'). */
export function Table({ cols, head, children, className = '' }: { cols: string; head: readonly ReactNode[]; children: ReactNode; className?: string }) {
  const style = { '--ha-cols': cols } as CSSProperties
  return (
    <div className={`ha-table ${className}`} style={style} role="table">
      <div className="ha-table__inner">
        <div className="ha-table__head" role="row">
          {head.map((h, i) => <div key={i} role="columnheader">{h}</div>)}
        </div>
        {children}
      </div>
    </div>
  )
}

export function Row({ children, href, className = '' }: { children: ReactNode; href?: string; className?: string }) {
  const cls = `ha-table__row ${className}`
  if (href) return <a href={href} className={cls} role="row">{children}</a>
  return <div className={cls} role="row">{children}</div>
}

export function Cell({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <div role="cell" className={className}>{children}</div>
}
