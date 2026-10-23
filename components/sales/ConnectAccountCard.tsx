'use client'
// "Receber pela Stripe" — the seller's Connect Express account, above the Pix key
// of /sales/payout. The states of the row (lib/stripe/connect-core.ts): not
// connected → "Conectar conta"; onboarding → "Continuar cadastro"; pendências →
// the list Stripe asks + "Completar cadastro"; ativa → "Abrir painel da Stripe".
// `?connect=return` syncs on mount; `?connect=refresh` (an expired link) restarts.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import type { ConnectAccountView } from '@/lib/stripe/connect-server'

const ICONS: Record<ConnectAccountView['status'], { name: string; tone: 'neutral' | 'pending' | 'alert' | 'verified' }> = {
  PENDING: { name: 'link_off', tone: 'neutral' },
  ONBOARDING: { name: 'pending_actions', tone: 'pending' },
  RESTRICTED: { name: 'warning', tone: 'alert' },
  ENABLED: { name: 'verified', tone: 'verified' },
  DISABLED: { name: 'block', tone: 'alert' },
}

export function ConnectAccountCard({ account: initial, connectParam }: { account: ConnectAccountView; connectParam: 'return' | 'refresh' | null }) {
  const [account, setAccount] = useState(initial)
  const [busy, setBusy] = useState<'start' | 'sync' | 'dashboard' | null>(connectParam ? (connectParam === 'return' ? 'sync' : 'start') : null)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])
  const started = useRef(false)

  async function call(path: 'start' | 'sync' | 'dashboard') {
    setBusy(path)
    const res = await fetch(`/api/sales/connect/${path}`, { method: 'POST' })
    const data = await res.json().catch(() => ({})) as { url?: string; account?: ConnectAccountView; error?: string }
    if (!res.ok) { setBusy(null); setToast(data.error ?? 'Não foi possível falar com a Stripe.'); return }
    if (path === 'sync' && data.account) { setAccount(data.account); setBusy(null); if (connectParam === 'return') setToast(data.account.status === 'ENABLED' ? 'Conta Stripe ativa · os repasses saem por ela' : 'Cadastro recebido · a Stripe ainda confere alguns dados'); return }
    if (data.url) { window.location.assign(data.url); return }
    setBusy(null)
  }

  useEffect(() => {
    if (started.current || !connectParam) return
    started.current = true
    window.history.replaceState(null, '', '/sales/payout')
    void call(connectParam === 'return' ? 'sync' : 'start')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on the return from Stripe
  }, [])

  const ic = ICONS[account.status]
  const primary = account.status === 'PENDING' ? { label: 'Conectar conta', path: 'start' as const }
    : account.status === 'ONBOARDING' ? { label: 'Continuar cadastro', path: 'start' as const }
    : account.status === 'RESTRICTED' ? { label: 'Completar cadastro', path: 'start' as const }
    : account.status === 'ENABLED' ? { label: 'Abrir painel da Stripe', path: 'dashboard' as const }
    : null

  return (
    <section className="ha-card ha-card--pad ha-connect" aria-busy={busy !== null}>
      <div className="ha-connect__head">
        <span className={`ha-connect__ic ha-connect__ic--${ic.tone}`}><Icon name={ic.name} size={20} filled={account.status === 'ENABLED'} /></span>
        <span className="ha-stack" style={{ gap: 2 }}>
          <span className="ha-connect__k">Receber pela Stripe{account.mode === 'test' ? ' · modo de teste' : ''}</span>
          <span className="ha-connect__v">{account.statusLabel}</span>
        </span>
      </div>
      <p className="ha-connect__sub">
        {account.status === 'ENABLED'
          ? 'A sua parte de cada venda é transferida para esta conta assim que o comprador confirma a entrega. Saques e extrato ficam no painel da Stripe.'
          : account.status === 'DISABLED'
            ? 'A Stripe desativou esta conta. Enquanto isso, os repasses saem pela chave Pix abaixo. Fale com a HouseArt para entender o motivo.'
            : 'Com a conta Stripe, a sua parte de cada venda cai sozinha, com comprovante. O cadastro é feito na própria Stripe (dados do titular, documento e conta bancária).'}
      </p>
      {account.requirements.length > 0 && account.status !== 'ENABLED' ? (
        <div className="ha-connect-req">
          <span className="ha-connect-req__t">A Stripe ainda pede</span>
          <ul className="ha-connect-req__l">{account.requirements.map((r) => <li key={r}><Icon name="arrow_right" size={16} />{r}</li>)}</ul>
        </div>
      ) : null}
      <div className="ha-connect__foot">
        {primary ? <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={busy !== null} onClick={() => call(primary.path)}>{busy === primary.path ? 'Abrindo a Stripe…' : primary.label}</button> : null}
        {account.status !== 'PENDING' ? <button type="button" className="ha-btn ha-btn--ghost ha-btn--sm" disabled={busy !== null} onClick={() => call('sync')}>{busy === 'sync' ? 'Conferindo…' : 'Atualizar situação'}</button> : null}
      </div>
      <span className="ha-connect__note"><Icon name="info" size={16} />{account.status === 'ENABLED' ? 'Sem conta Stripe o repasse seria manual, pela chave Pix.' : 'Sem a conta Stripe, o repasse é manual, pela chave Pix cadastrada abaixo.'}</span>
      <Toast message={toast} onDone={clearToast} />
    </section>
  )
}
