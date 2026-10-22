'use client'
// Favoritos e curtidos (handoff "HouseArt App Colecionador" › Coleção › Favoritos · Curtidos):
// Favoritos = the saved artworks as rows (wall 80 · title · artist · seller · price · Comprar/Ver),
// Curtidos = the liked ones as a 3-column wall grid with the line "N obras curtidas…".
// Removing is the same toggle (POST /api/community/reactions) and the row leaves the list.
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { formatBRL } from '@/lib/artworks/domain'
import './favorites.css'

export interface FavoriteRow { id: number; publicId: string; title: string; year: number | null; artist: string; priceCents: string | null; saleMode: string | null; status: string; cover: string | null; liked: boolean; saved: boolean }
export type FavoritesTab = 'saved' | 'liked'

const available = (r: FavoriteRow) => r.status === 'LISTED'
const priceOf = (r: FavoriteRow) => (!available(r) ? 'Indisponível' : r.priceCents === null ? 'Sob consulta' : formatBRL(BigInt(r.priceCents)))

export function FavoritesScreen({ rows: initial, tab }: { rows: FavoriteRow[]; tab: FavoritesTab }) {
  const [rows, setRows] = useState(initial)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const clearToast = useCallback(() => setToast(''), [])
  const saved = rows.filter((r) => r.saved), liked = rows.filter((r) => r.liked)

  async function remove(r: FavoriteRow, kind: 'LIKE' | 'SAVE') {
    setBusy(r.id)
    const res = await fetch('/api/community/reactions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: 'ARTWORK', targetId: r.id, kind }) })
    setBusy(null)
    if (!res.ok) { setToast('Não foi possível remover agora.'); return }
    const data = (await res.json().catch(() => ({}))) as { on?: boolean }
    if (data.on) return // it was off and turned on (stale page): keep it
    setRows((xs) => xs.map((x) => (x.id === r.id ? { ...x, [kind === 'SAVE' ? 'saved' : 'liked']: false } : x)))
    setToast(kind === 'SAVE' ? 'Removida dos favoritos' : 'Curtida removida')
  }

  return (
    <div className="ha-fav">
      <div className="ha-page__head"><h1 className="ha-h1">Favoritos e curtidos</h1></div>
      <nav className="ha-tabs" aria-label="Abas">
        <Link href="/favorites" className={`ha-tab${tab === 'saved' ? ' ha-tab--on' : ''}`} aria-current={tab === 'saved' ? 'page' : undefined}>Favoritos · {saved.length}</Link>
        <Link href="/favorites?tab=liked" className={`ha-tab${tab === 'liked' ? ' ha-tab--on' : ''}`} aria-current={tab === 'liked' ? 'page' : undefined}>Curtidos · {liked.length}</Link>
      </nav>

      {tab === 'saved' ? (
        <div className="ha-fav__list">
          {saved.map((r) => (
            <div key={r.id} className="ha-fav-row">
              <Link href={`/e/artwork/${r.publicId}`} className="ha-wall ha-fav-row__wall" aria-label={`Ver obra ${r.title}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                {r.cover ? <img src={r.cover} alt="" /> : null}
              </Link>
              <span className="ha-stack ha-fav-row__txt">
                <i className="ha-fav-row__t">{r.title}{r.year ? `, ${r.year}` : ''}</i>
                <span className="ha-fav-row__s">{r.artist}</span>
                <span className="ha-fav-row__foot">
                  <span className="ha-fav-row__p">{priceOf(r)}</span>
                  <span className="ha-row">
                    <button type="button" className="ha-iconbtn ha-fav-row__rm" aria-label="Remover dos favoritos" disabled={busy === r.id} onClick={() => remove(r, 'SAVE')}><Icon name="bookmark" size={20} filled /></button>
                    {available(r) && r.priceCents !== null ? <Link href={`/e/artwork/${r.publicId}/buy`} className="ha-btn ha-btn--primary ha-btn--xs">Comprar</Link> : <Link href={`/e/artwork/${r.publicId}`} className="ha-btn ha-btn--outline ha-btn--xs">Ver</Link>}
                  </span>
                </span>
              </span>
            </div>
          ))}
          {saved.length === 0 ? <div className="ha-fav__empty">Toque no marcador de uma obra para guardá-la aqui. <Link href="/explore" className="ha-link">Explorar obras</Link></div> : null}
        </div>
      ) : (
        <div className="ha-fav__liked">
          <span className="ha-fav__note">{liked.length} {liked.length === 1 ? 'obra curtida' : 'obras curtidas'}. Artistas das obras curtidas aparecem primeiro no Descobrir.</span>
          {liked.length ? (
            <div className="ha-fav__grid">
              {liked.map((r) => (
                <div key={r.id} className="ha-fav-tile">
                  <Link href={`/e/artwork/${r.publicId}`} className="ha-wall ha-fav-tile__wall" aria-label={r.title}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                    {r.cover ? <img src={r.cover} alt="" /> : null}
                  </Link>
                  <button type="button" className="ha-fav-tile__rm" aria-label={`Remover curtida de ${r.title}`} disabled={busy === r.id} onClick={() => remove(r, 'LIKE')}><Icon name="favorite" size={18} filled /></button>
                </div>
              ))}
            </div>
          ) : <div className="ha-fav__empty">Curta obras no Explorar para vê-las aqui. <Link href="/explore?view=discover" className="ha-link">Descobrir</Link></div>}
        </div>
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
