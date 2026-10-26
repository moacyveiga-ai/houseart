// Ratchet of navigation targets (audit 2026-10-25: the sidebar footer pointed at
// /settings and /help, which never existed). Every href the panel menu, the
// drawer, the account link and the public header can show must be a page.
import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { accountHrefOf, HELP_HREF, NAV, type ProfileKind } from '@/lib/profiles/nav'
import { PUBLIC_NAV } from '@/components/public/PublicHeader'
import { ROOT } from './source-graph'

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (name === 'api' || name === 'generated') return []
    if (statSync(p).isDirectory()) return pages(p)
    return name === 'page.tsx' ? [p] : []
  })
}

/** app/(panel)/artworks/[id]/page.tsx → /artworks/[id] (route groups dropped). */
const routes = pages(join(ROOT, 'app')).map((f) => '/' + relative(join(ROOT, 'app'), f).split(sep).slice(0, -1).filter((s) => !/^\(.*\)$/.test(s)).join('/'))

function exists(href: string): boolean {
  const path = href.split(/[?#]/)[0].replace(/\/$/, '') || '/'
  const parts = path.split('/').filter(Boolean)
  return routes.some((r) => {
    const rs = r.split('/').filter(Boolean)
    return rs.length === parts.length && rs.every((s, i) => s.startsWith('[') || s === parts[i])
  })
}

describe('navigation targets are pages', () => {
  it('the reader sees the routes', () => {
    expect(exists('/')).toBe(true)
    expect(exists('/artworks/12/listing')).toBe(true)
    expect(exists('/settings')).toBe(false)
  })

  it('every NAV item, account link and help link of every profile', () => {
    const missing: string[] = []
    for (const profile of Object.keys(NAV) as ProfileKind[]) {
      for (const item of NAV[profile]) if (!exists(item.href)) missing.push(`${profile}: ${item.href}`)
      if (!exists(accountHrefOf(profile))) missing.push(`${profile} conta: ${accountHrefOf(profile)}`)
    }
    if (!exists(HELP_HREF)) missing.push(`ajuda: ${HELP_HREF}`)
    expect(missing).toEqual([])
  })

  it('every link of the public header', () => {
    expect(PUBLIC_NAV.map((n) => n.href).filter((h) => !exists(h))).toEqual([])
  })
})
