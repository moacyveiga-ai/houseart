// Button of the handoff (HouseArt Design System.dc.html › Herdados › Button):
// variants color (`primary`) · fill (`ink`) · bord (`outline`) · empty (`ghost`),
// states default / hover / active / focus / disabled / loading, sizes
// xs 32 · sm 40 · md 48 (the names the 17 screens already use; `lg` = md).
import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'

type Variant = 'primary' | 'ink' | 'outline' | 'outline-paper' | 'paper' | 'ghost'
type Size = 'xs' | 'sm' | 'md' | 'lg'

interface Common { variant?: Variant; size?: Size; icon?: string; children?: ReactNode; className?: string; loading?: boolean }
type ButtonProps = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>
type LinkProps = Common & { href: string }

function classes({ variant = 'primary', size = 'md', className = '', disabled, loading }: Common & { disabled?: boolean }) {
  return ['ha-btn', `ha-btn--${variant}`, `ha-btn--${size}`, disabled ? 'ha-btn--disabled' : '', loading ? 'ha-btn--loading' : '', className].filter(Boolean).join(' ')
}

export function Button({ variant, size, icon, children, className, loading, ...rest }: ButtonProps) {
  return (
    <button type="button" aria-busy={loading || undefined} {...rest} disabled={rest.disabled || loading} className={classes({ variant, size, className, disabled: rest.disabled, loading })}>
      {loading ? <span className="ha-spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </button>
  )
}

export function ButtonLink({ href, variant, size, icon, children, className }: LinkProps) {
  return (
    <Link href={href} className={classes({ variant, size, className })}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </Link>
  )
}
