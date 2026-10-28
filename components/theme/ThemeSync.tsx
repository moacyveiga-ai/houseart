'use client'
// Reapplies the saved theme on every client navigation: the anti-flash script only runs on the
// first load, so going from /login (always light) to the panel — or from the panel to /e —
// without a reload would keep the previous page's attribute.
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { applyTheme, getTheme } from '@/lib/theme'

export function ThemeSync() {
  const pathname = usePathname()
  useEffect(() => { applyTheme(getTheme()) }, [pathname])
  return null
}
