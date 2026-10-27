'use client'
// "Buscas recentes" (audit colecionador §229): with a term in the URL the term is remembered; without
// one the last five are listed, each opening the search again or removed with ×. The list lives in
// this account's key in the browser's localStorage (`recentKeyOf`; the team gets none), read through useSyncExternalStore (the server snapshot is empty, so the
// first paint never mismatches); a blocked storage just means no list.
import Link from 'next/link'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { Icon } from '@/components/ds/Icon'
import { parseRecent, pushRecent, removeRecent } from './recent-core'

const EVENT = 'ha-search-recent'
function read(key: string): string | null { try { return window.localStorage.getItem(key) } catch { return null } }
function write(key: string, list: string[]) {
  try { window.localStorage.setItem(key, JSON.stringify(list)) } catch { /* private window: no list */ }
  window.dispatchEvent(new Event(EVENT))
}
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(EVENT, onChange)
  return () => { window.removeEventListener('storage', onChange); window.removeEventListener(EVENT, onChange) }
}

export function RecentSearches({ q, storageKey }: { q: string; storageKey: string }) {
  const raw = useSyncExternalStore(subscribe, () => read(storageKey), () => null)
  const list = useMemo(() => parseRecent(raw), [raw])
  useEffect(() => { if (q.trim()) write(storageKey, pushRecent(parseRecent(read(storageKey)), q)) }, [q, storageKey])
  if (q || list.length === 0) return null
  return (
    <section className="ha-search-sec" aria-label="Buscas recentes">
      <span className="ha-search-sec__k">Buscas recentes</span>
      <ul className="ha-search-recent">
        {list.map((t) => (
          <li key={t} className="ha-search-recent__row">
            <Icon name="history" size={20} />
            <Link href={`/search?q=${encodeURIComponent(t)}`} className="ha-search-recent__t">{t}</Link>
            <button type="button" className="ha-search-recent__x" aria-label={`Remover ${t}`} onClick={() => write(storageKey, removeRecent(list, t))}><Icon name="close" size={18} /></button>
          </li>
        ))}
      </ul>
    </section>
  )
}
