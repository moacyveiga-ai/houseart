'use client'
// Avisos (handoff "HouseArt App Artista" › Avisos): the list with a round icon
// per kind, title, sub and the short "quando"; tapping marks it read and opens
// the href; "Marcar todas como lidas"; and the "Avisos no celular" toggle that
// registers the web push of this browser.
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ds/Icon'
import { Toggle } from '@/components/ds/Toggle'
import { Toast } from '@/components/ds/Toast'
import { iconOf, toneOf, whenShort, type NotificationRow } from './notifications-core'
import { currentSubscription, pushSupported, subscribe, unsubscribe } from './push-client'

export function NotificationsScreen({ items: initial, unread: initialUnread, publicKey }: { items: NotificationRow[]; unread: number; publicKey: string | null }) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [unread, setUnread] = useState(initialUnread)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushNote, setPushNote] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (!publicKey) return
    // Read the browser after mount (the server rendered "supported"); the answer comes back async.
    let alive = true
    currentSubscription().then((s) => { if (!alive) return; if (!pushSupported()) setSupported(false); else setPushOn(!!s) }).catch(() => { if (alive) setSupported(false) })
    return () => { alive = false }
  }, [publicKey])

  async function open(n: NotificationRow) {
    if (!n.readAt) {
      const now = new Date().toISOString()
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, readAt: now } : x)))
      setUnread((u) => Math.max(0, u - 1))
      await fetch(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined)
      router.refresh()
    }
    if (n.href) router.push(n.href)
  }

  async function readAll() {
    const res = await fetch('/api/notifications', { method: 'POST' })
    if (!res.ok) { setToast('Não foi possível marcar.'); return }
    const now = new Date().toISOString()
    setItems((xs) => xs.map((x) => (x.readAt ? x : { ...x, readAt: now })))
    setUnread(0)
    setToast('Todos os avisos marcados como lidos')
    router.refresh()
  }

  async function togglePush(next: boolean) {
    if (!publicKey || pushBusy) return
    setPushBusy(true); setPushNote(null)
    if (next) {
      const r = await subscribe(publicKey)
      if (r.ok) { setPushOn(true); setToast('Avisos no celular ligados neste aparelho') } else setPushNote(r.reason)
    } else {
      await unsubscribe()
      setPushOn(false); setToast('Avisos no celular desligados')
    }
    setPushBusy(false)
  }

  const pushSub = !publicKey ? 'Em breve · o envio ao celular ainda não foi ligado nesta instalação' : !supported ? 'Este navegador não recebe avisos no celular' : pushOn ? 'Ligado neste aparelho' : 'Receba ofertas, mensagens e entregas mesmo com o app fechado'

  return (
    <div className="ha-ntf">
      <div className="ha-ntf__head">
        <h1 className="ha-h1">Avisos</h1>
        {unread > 0 ? <button type="button" className="ha-btn ha-btn--outline ha-btn--xs" onClick={readAll}><Icon name="done_all" size={18} />Marcar todas como lidas</button> : null}
      </div>

      <div className="ha-ntf-push">
        <span className="ha-ntf-push__icon"><Icon name="phone_iphone" size={20} /></span>
        <span className="ha-ntf-push__t">
          <span className="ha-ntf-push__name">Avisos no celular</span>
          <span className={`ha-ntf-push__sub${pushNote ? ' ha-ntf-push__sub--error' : ''}`}>{pushNote ?? pushSub}</span>
        </span>
        <Toggle on={pushOn} onChange={togglePush} label="Avisos no celular" disabled={!publicKey || !supported || pushBusy} />
      </div>

      <div className="ha-ntf__list" role="list">
        {items.length === 0 ? <div className="ha-ntf__empty">Nenhum aviso por enquanto. Ofertas, mensagens, entregas e escrituras chegam aqui.</div> : null}
        {items.map((n) => {
          const tone = toneOf(n)
          return (
            <button key={n.id} type="button" role="listitem" className={`ha-ntf-row${n.readAt ? ' ha-ntf-row--read' : ''}`} onClick={() => open(n)} aria-label={`${n.title}${n.readAt ? '' : ' · não lido'}`}>
              <span className={`ha-ntf-row__icon ha-ntf-row__icon--${tone}`}><Icon name={iconOf(n.kind)} /></span>
              <span className="ha-ntf-row__body">
                <span className="ha-ntf-row__title">{n.title}</span>
                {n.body ? <span className="ha-ntf-row__sub">{n.body}</span> : null}
              </span>
              <span className="ha-ntf-row__when">{whenShort(n.createdAt)}</span>
            </button>
          )
        })}
      </div>
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
