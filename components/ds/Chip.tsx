import Link from 'next/link'
import type { ReactNode } from 'react'

export function Chip({ on = false, href, onClick, children }: { on?: boolean; href?: string; onClick?: () => void; children: ReactNode }) {
  const cls = `ha-chip${on ? ' ha-chip--on' : ''}`
  if (href) return <Link href={href} className={cls} aria-current={on ? 'page' : undefined}>{children}</Link>
  return <button type="button" className={cls} aria-pressed={on} onClick={onClick}>{children}</button>
}
