'use client'
// The Acervo search filters as the person types (audit galeria §2): the same GET form,
// with the URL replaced 300 ms after the last key. Without JS, Enter submits the form.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ds/Icon'
import { inventoryHref } from './inventory-core'

export function InventorySearch({ chip, q }: { chip: string; q: string }) {
  const router = useRouter()
  const [value, setValue] = useState(q)
  const last = useRef(q)
  useEffect(() => {
    const next = value.trim()
    if (next === last.current) return
    const t = setTimeout(() => { last.current = next; router.replace(inventoryHref(chip, next), { scroll: false }) }, 300)
    return () => clearTimeout(t)
  }, [value, chip, router])
  return (
    <form className="ha-inv__search" role="search" action="/artworks" method="get" onSubmit={(e) => { e.preventDefault(); last.current = value.trim(); router.replace(inventoryHref(chip, value.trim()), { scroll: false }) }}>
      <input type="hidden" name="filter" value={chip} />
      <Icon name="search" size={20} />
      <input name="q" className="ha-inv__input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Título, artista ou certificado" aria-label="Buscar no acervo" />
    </form>
  )
}
