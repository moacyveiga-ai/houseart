'use client'
// "Buscas recentes" (audit colecionador §229): with a term in the URL the term is remembered; without
// one the last five are listed, each opening the search again or removed with ×. The list lives in
// this viewer's localStorage, read through useSyncExternalStore (the server snapshot is empty, so the
// first paint never mismatches); a blocked storage just means no list.
import Link from 'next/link'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { Icon } from '@/components/ds/Icon'
import { parseRecent, pushRecent, removeRecent, RECENT_KEY } from './recent-core'

const EVENT = 'ha-search-recent'
function read(): string | null { try { return window.localStorage.getItem(RECENT_KEY) } catch { return null } }
function write(list: string[]) {
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(list)) } catch { /* private window: no list */ }
  window.dispatchEvent(new Event(EVENT))
}
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(EVENT, onChange)
  return () => { window.removeEventListener('storage', onChange); window.removeEventListener(EVENT, onChange) }
}

export function RecentSearches({ q }: { q: string }) {
  const raw = useSyncExternalStore(subscribe, read, () => null)
  const list = useMemo(() => parseRecent(raw), [raw])
  useEffect(() => { if (q.trim()) write(pushRecent(parseRecent(read()), q)) }, [q])
  if (q || list.length === 0) return null
  return (
    <section className="ha-search-sec" aria-label="Buscas recentes">
      <span className="ha-search-sec__k">Buscas recentes</span>
      <ul className="ha-search-recent">
        {list.map((t) => (
          <li key={t} className="ha-search-recent__row">
            <Icon name="history" size={20} />
            <Link href={`/search?q=${encodeURIComponent(t)}`} className="ha-search-recent__t">{t}</Link>
            <button type="button" className="ha-search-recent__x" aria-label={`Remover ${t}`} onClick={() => write(removeRecent(list, t))}><Icon name="close" size={18} /></button>
          </li>
        ))}
      </ul>
    </section>
  )
}
