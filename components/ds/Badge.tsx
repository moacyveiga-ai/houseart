import type { ReactNode } from 'react'

export type BadgeTone = 'verified' | 'pending' | 'alert' | 'neutral' | 'soft' | 'ink'

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={`ha-badge ha-badge--${tone} ${className}`}>{children}</span>
}
