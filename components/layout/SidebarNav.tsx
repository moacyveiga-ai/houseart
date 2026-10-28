'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ds/Icon'
import { activeNavKey, NAV, type ProfileKind } from '@/lib/profiles/nav'

/**
 * The sidebar items. The active one follows the URL in the browser: the panel
 * layout is not re-rendered on client navigation (Next 16), so a key computed
 * on the server would stay on the first page visited. `initialKey` is the
 * server's answer, used only before the pathname is known.
 */
export function SidebarNav({ profile, badges, initialKey }: { profile: ProfileKind; badges: Record<string, number>; initialKey: string | null }) {
  const pathname = usePathname()
  const activeKey = pathname ? activeNavKey(profile, pathname) : initialKey
  return (
    <nav aria-label="Principal">
      {NAV[profile].map((item) => {
        const on = item.key === activeKey
        const badge = badges[item.key]
        return (
          <Link key={item.key} href={item.href} className={`ha-nav-item${on ? ' ha-nav-item--on' : ''}`} aria-current={on ? 'page' : undefined}>
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
            {badge ? <span className="ha-nav-badge">{badge}</span> : null}
          </Link>
        )
      })}
    </nav>
  )
}
