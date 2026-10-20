import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'

type Variant = 'primary' | 'ink' | 'outline' | 'outline-paper' | 'paper' | 'ghost'
type Size = 'xs' | 'sm' | 'md'

interface Common { variant?: Variant; size?: Size; icon?: string; children?: ReactNode; className?: string }
type ButtonProps = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>
type LinkProps = Common & { href: string }

function classes({ variant = 'primary', size = 'md', className = '', disabled }: Common & { disabled?: boolean }) {
  return ['ha-btn', `ha-btn--${variant}`, `ha-btn--${size}`, disabled ? 'ha-btn--disabled' : '', className].filter(Boolean).join(' ')
}

export function Button({ variant, size, icon, children, className, ...rest }: ButtonProps) {
  return (
    <button type="button" {...rest} className={classes({ variant, size, className, disabled: rest.disabled })}>
      {icon ? <Icon name={icon} size={18} /> : null}
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
