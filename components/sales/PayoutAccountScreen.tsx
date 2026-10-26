'use client'
// Pix para receber vendas (handoff "HouseArt App Colecionador" › sheet pix).
// "Não cadastrado" = the sheet's form; cadastrado = the card of the wallet
// block, with "Trocar chave" (reopens the form) and "Remover".
import { useCallback, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { PIX_KEY_TYPE_LABELS, type PixKeyType } from '@/lib/payment-methods/domain'
import type { PayoutAccountView } from '@/lib/payment-methods/server'
import { PixKeyForm } from './PixKeyForm'

export function PayoutAccountScreen({ account: initial, holderName, cpfMask }: { account: PayoutAccountView | null; holderName: string; cpfMask: string | null }) {
  const [account, setAccount] = useState(initial)
  const [editing, setEditing] = useState(initial === null)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  function saved(a: PayoutAccountView) {
    setAccount(a)
    setEditing(false)
    setToast('Chave Pix confirmada no seu nome · pronta para receber')
  }

  async function remove() {
    const res = await fetch('/api/member/payout-account', { method: 'DELETE' })
    if (!res.ok) { setToast('Não foi possível remover a chave.'); return }
    setAccount(null)
    setEditing(true)
    setToast('Chave Pix removida · cadastre outra para receber vendas')
  }

  return (
    <div className="ha-payout">
      <section className="ha-card ha-card--pad ha-payout__main">
        {account && !editing ? (
          <>
            <div className="ha-payout-card">
              <div className="ha-payout-card__row">
                <span className="ha-payout-card__ic"><Icon name="account_balance" size={20} /></span>
                <span className="ha-stack">
                  <span className="ha-payout-card__k">Chave Pix · {PIX_KEY_TYPE_LABELS[account.pixKeyType as PixKeyType] ?? account.pixKeyType}</span>
                  <span className="ha-payout-card__v">{account.pixKeyMask}</span>
                </span>
              </div>
              <span className="ha-payout-card__holder"><Icon name="verified" size={16} filled />{account.holderName} · titular da conta</span>
              <span className="ha-payout-card__s">Repasse em até 1 dia útil depois que o comprador confirma a entrega.</span>
            </div>
            <div className="ha-payout-foot">
              <div className="ha-payout-foot__secondary">
                <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => setEditing(true)}>Trocar chave</button>
                <button type="button" className="ha-payout-remove" onClick={remove}>Remover</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <PixKeyForm
              holderName={holderName} cpfMask={cpfMask}
              intro={account ? 'Troque a chave onde você recebe o valor das vendas. Repasses em andamento vão para a chave anterior.' : 'É para esta chave que enviamos o valor das suas vendas, depois que o comprador confirma a entrega.'}
              submitLabel={account ? 'Salvar nova chave' : 'Cadastrar chave Pix'} onSaved={saved}
              secondary={account ? <><button type="button" className="ha-btn ha-btn--ghost ha-btn--sm" onClick={() => setEditing(false)}>Cancelar</button><button type="button" className="ha-payout-remove" onClick={remove}>Remover chave</button></> : null}
            />
          </>
        )}
      </section>
      <aside className="ha-payout__aside">
        <div className="ha-payout-notes">
          <span><Icon name="schedule" size={16} />O valor da venda cai em até 1 dia útil depois que o comprador confirma a entrega.</span>
          <span><Icon name="receipt_long" size={16} />Você recebe já com a taxa HouseArt e o direito de sequência descontados, com comprovante.</span>
        </div>
      </aside>
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
