'use client'
// Exposições: the Individuais / Coletivas tabs of the Artista prototype (one small island).
import { useState } from 'react'

export interface ExhibitionRow { year: string; title: string; venue: string | null; city: string | null }

export function ExhibitionTabs({ solo, group }: { solo: ExhibitionRow[]; group: ExhibitionRow[] }) {
  const tabs = [{ key: 'solo', label: 'Individuais', rows: solo }, { key: 'group', label: 'Coletivas', rows: group }].filter((t) => t.rows.length)
  const [active, setActive] = useState(tabs[0]?.key ?? 'solo')
  const rows = tabs.find((t) => t.key === active)?.rows ?? []
  return (
    <>
      <div className="hp-artist-section-head">
        <h2 className="hp-section-title">Exposições</h2>
        {tabs.length > 1 ? (
          <div className="hp-artist-expo-tabs" role="tablist" aria-label="Tipo de exposição">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={t.key === active} className={`hp-artist-expo-tab${t.key === active ? ' hp-artist-expo-tab--on' : ''}`} onClick={() => setActive(t.key)}>
                {t.label} ({t.rows.length})
              </button>
            ))}
          </div>
        ) : <span className="hp-artist-sub">{tabs[0]?.label} ({tabs[0]?.rows.length})</span>}
      </div>
      <div className="hp-artist-expos" role="tabpanel">
        {rows.map((e, i) => (
          <div key={`${e.year}-${e.title}-${i}`} className="hp-artist-expo">
            <span className="hp-artist-expo__year">{e.year}</span>
            <span className="hp-artist-expo__title">{e.title}</span>
            <span className="hp-artist-expo__venue">{e.venue}</span>
            <span className="hp-artist-expo__city">{e.city}</span>
          </div>
        ))}
      </div>
    </>
  )
}
