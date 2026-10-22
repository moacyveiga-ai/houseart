import { requirePanelPage } from '../_session'
import { listNotifications, unreadCount } from '@/lib/notifications/server'
import { pushConfig } from '@/lib/notifications/push'
import { NotificationsScreen } from '@/components/notifications/NotificationsScreen'
import '@/components/notifications/notifications.css'

export const metadata = { title: 'Avisos — HouseArt' }

export default async function NotificationsPage() {
  const { user } = await requirePanelPage('/notifications')
  const [rows, unread] = await Promise.all([listNotifications(user.id), unreadCount(user.id)])
  const items = rows.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }))
  return (
    <div className="ha-page">
      <NotificationsScreen items={items} unread={unread} publicKey={pushConfig()?.publicKey ?? null} />
    </div>
  )
}
