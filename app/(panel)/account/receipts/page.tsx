import Link from 'next/link'
import { requirePanelPage } from '../../_session'
import { receiptKindLabel, receiptsOf } from '@/lib/accounts/receipts-server'
import { Icon } from '@/components/ds/Icon'
import '@/components/gallery/account.css'
import '@/components/collector/collector-account.css'

export const metadata = { title: 'Notas e comprovantes — HouseArt' }

const day = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bahia' })

/** Notas e comprovantes (Perfil › Pagamentos): every payment the person made, newest first. */
export default async function ReceiptsPage() {
  const { user } = await requirePanelPage('/account/receipts')
  const rows = await receiptsOf(user.id)
  return (
    <div className="ha-page">
      <div className="ha-account ha-cacct">
        <div className="ha-cacct__bar"><Link href="/account" className="ha-iconbtn ha-cacct__back" aria-label="Voltar"><Icon name="arrow_back" size={24} /></Link><span className="ha-cacct__bar-t">Notas e comprovantes</span></div>
        {rows.length === 0 ? <p className="ha-sm ha-muted">Nenhum pagamento ainda. Compras, serviços e taxas pagos aparecem aqui.</p> : null}
        <div className="ha-receipts">
          {rows.map((r) => {
            const body = (<>
              <span className="ha-stack"><span className="ha-receipt__k">{receiptKindLabel(r.kind)} · {day(r.at)}</span><span className="ha-receipt__t">{r.title}</span><span className="ha-receipt__k">{r.sub}</span></span>
              <span className="ha-receipt__v">{r.amount}</span>
            </>)
            return r.href ? <Link key={r.key} href={r.href} className="ha-receipt">{body}</Link> : <div key={r.key} className="ha-receipt">{body}</div>
          })}
        </div>
        <p className="ha-sm ha-muted">A nota fiscal de cada serviço chega por e-mail quando a emissão estiver ligada.</p>
      </div>
    </div>
  )
}
