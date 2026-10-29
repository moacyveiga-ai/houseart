'use client'
// Reapplies the saved theme on every client navigation: the anti-flash script only runs on the
// first load, so going from /login (always light) to the panel — or from the panel to /e —
// without a reload would keep the previous page's attribute.
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { applyTheme, getTheme, hasStoredTheme, setTheme } from '@/lib/theme'
import { isAlwaysLightRoute, isTheme } from '@/lib/theme-routes'

const FETCHED_KEY = 'ha-theme-fetched'

export function ThemeSync() {
  const pathname = usePathname()
  useEffect(() => {
    applyTheme(getTheme())
    // A new device (nothing stored): the theme saved on the account, asked once per tab, only in the panel.
    if (isAlwaysLightRoute(pathname) || hasStoredTheme()) return
    try { if (window.sessionStorage.getItem(FETCHED_KEY)) return; window.sessionStorage.setItem(FETCHED_KEY, '1') } catch { return }
    void fetch('/api/auth/preferences', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { theme?: unknown } | null) => { if (j && isTheme(j.theme) && !hasStoredTheme()) setTheme(j.theme) })
      .catch(() => {})
  }, [pathname])
  return null
}
