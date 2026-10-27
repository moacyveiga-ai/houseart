'use client'
// The marketplace search filters as the person types (audit público, Marketplace): the same GET
// form, with the URL replaced 300 ms after the last key and the other filters kept. Without JS,
// Enter submits the form with its hidden fields.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ds/Icon'
import { paramsOf, type GroupKey, type Selection, type SortKey } from '@/lib/marketplace/filter-core'

export function MarketplaceSearch({ sel, q, sort }: { sel: Selection; q: string; sort: SortKey }) {
  const router = useRouter()
  const [value, setValue] = useState(q)
  const [sent, setSent] = useState(q)
  // Back/Forward or a filter link changes `q` without this box: follow it (a `q` we sent is ignored)
  const [seenQ, setSeenQ] = useState(q)
  if (q !== seenQ) {
    setSeenQ(q)
    if (q !== sent) { setValue(q); setSent(q) }
  }
  const go = (next: string) => { setSent(next); router.replace('/e/marketplace' + paramsOf(sel, next, sort), { scroll: false }) }
  useEffect(() => {
    const next = value.trim()
    if (next === sent) return
    const t = setTimeout(() => go(next), 300)
    return () => clearTimeout(t)
  })
  return (
    <form method="get" action="/e/marketplace" className="hp-market-search" role="search" onSubmit={(e) => { e.preventDefault(); go(value.trim()) }}>
      <Icon name="search" size={22} />
      <input name="q" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Obra, artista, galeria ou técnica" aria-label="Buscar" maxLength={120} className="hp-market-search__input" />
      {(Object.keys(sel) as GroupKey[]).filter((g) => sel[g].length).map((g) => <input key={g} type="hidden" name={g} value={sel[g].join(',')} />)}
      {sort !== 'rel' ? <input type="hidden" name="sort" value={sort} /> : null}
    </form>
  )
}
