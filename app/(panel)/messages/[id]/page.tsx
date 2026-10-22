import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { listConversations } from '@/lib/messaging/server'
import { MessagesScreen } from '@/components/messaging/MessagesScreen'
import { conversationIdOfPath, roleOfProfile } from '@/components/messaging/messages-core'
import '@/components/messaging/messages.css'

export const metadata = { title: 'Conversa — HouseArt' }

// "Conversa com galeria" / "Conversa com compradora": the same island with the
// conversation open (the whole screen on the phone, the right pane on desktop).
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id
  const id = conversationIdOfPath(`/messages/${raw}`)
  if (!id) notFound()
  const { user, nav } = await requirePanelPage(`/messages/${id}`)
  const rows = await listConversations(user.id)
  return <MessagesScreen initialRows={rows} initialConversationId={id} role={roleOfProfile(nav)} />
}
