// status-badge (átomo): os sete estados do handoff, com o ícone de cada um.
import { Icon } from './Icon'

export type ArtworkStatus = 'verified' | 'pending' | 'contested' | 'stolen' | 'transferred' | 'for-sale' | 'sold'

const LABEL: Record<ArtworkStatus, string> = {
  verified: 'Autenticada', pending: 'Em certificação', contested: 'Contestada', stolen: 'Roubada',
  transferred: 'Transferida', 'for-sale': 'À venda', sold: 'Vendida',
}
const ICON: Partial<Record<ArtworkStatus, { name: string; filled?: boolean }>> = {
  verified: { name: 'verified', filled: true }, pending: { name: 'schedule' }, contested: { name: 'report' },
  stolen: { name: 'gpp_bad' }, transferred: { name: 'swap_horiz' },
}

export function StatusBadge({ status, inline = false, label }: { status: ArtworkStatus; inline?: boolean; label?: string }) {
  const icon = ICON[status]
  return (
    <span className={`ha-status ha-status--${status}${inline ? ' ha-status--inline' : ''}`}>
      {icon ? <Icon name={icon.name} filled={icon.filled} size={16} /> : null}
      {label ?? LABEL[status]}
    </span>
  )
}

export const statusLabel = (s: ArtworkStatus) => LABEL[s]
