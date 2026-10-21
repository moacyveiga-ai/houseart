'use client'
// Ilha mínima: o <select> de ordenação envia o <form method="get"> ao mudar
// (sem JS a pessoa envia pelo Enter da busca; o select continua funcional).
import type { ReactNode } from 'react'

export function MarketplaceSortSelect({ name, defaultValue, id, children }: { name: string; defaultValue: string; id?: string; children: ReactNode }) {
  return (
    <select id={id} name={name} defaultValue={defaultValue} className="hp-market-sort__select" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {children}
    </select>
  )
}
