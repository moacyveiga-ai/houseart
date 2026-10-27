import { requirePanelPage } from '../_session'
import { listConversations } from '@/lib/messaging/server'
import { MessagesScreen } from '@/components/messaging/MessagesScreen'
import { emptyListText, roleOfProfile } from '@/components/messaging/messages-core'
import '@/components/messaging/messages.css'

export const metadata = { title: 'Mensagens — HouseArt' }

// "Mensagens" (handoff App Colecionador / App Galeria; Web: list + conversation).
export default async function MessagesPage() {
  const { user, nav } = await requirePanelPage('/messages')
  const rows = await listConversations(user.id)
  return <MessagesScreen initialRows={rows} initialConversationId={null} role={roleOfProfile(nav)} emptyText={emptyListText(nav)} />
}
