import { Tabs, useRouter } from 'expo-router'
import { Pressable } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSession } from '@/auth/session'
import { useUnreadMessages } from '@/api/unread'
import { TABS, iconFor, isCollector, labelFor, tabsFor, type TabKey } from '@/nav/tabs'
import { theme } from '@/theme'

const ALL: TabKey[] = ['explore', 'messages', 'community', 'wallet', 'profile', 'home', 'artworks', 'sales', 'certification', 'notifications']

/**
 * One binary, three modes: the profile of the session decides which tabs
 * exist (the others get `href: null` and never show). The chosen set comes
 * first so the first visible tab is the initial one.
 */
export default function TabsLayout() {
  const { me, status } = useSession()
  const router = useRouter()
  // The Mensagens badge: unread messages polled every 30 s while the app is active.
  const unread = useUnreadMessages(status === 'signed-in')
  const kind = me?.activeProfileKind ?? null
  const visible = tabsFor(kind)
  const ordered = [...visible, ...ALL.filter((k) => !visible.includes(k))]
  const hasProfileTab = visible.includes('profile')

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.fg,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '600' },
        tabBarActiveTintColor: theme.fg,
        tabBarInactiveTintColor: theme.fgMuted,
        tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.border },
        // The native profile screen is reachable from every tab when it is not a tab itself.
        headerRight: hasProfileTab ? undefined : () => (
          <Pressable accessibilityRole="button" accessibilityLabel="Perfil" onPress={() => router.push('/settings')} style={{ paddingHorizontal: 16 }}>
            <MaterialIcons name="person" size={24} color={theme.fg} />
          </Pressable>
        ),
      }}
    >
      {ordered.map((key) => {
        const def = TABS[key]
        const shown = visible.includes(key)
        const icon = iconFor(kind, key)
        return (
          <Tabs.Screen
            key={key}
            name={key}
            options={{
              href: shown ? undefined : null,
              title: labelFor(kind, key),
              // The native screens draw their own top (brand, search, title) as the prototype does.
              headerShown: key === 'profile' || def.path !== null || (key === 'wallet' && !isCollector(kind)),
              tabBarIcon: ({ color, size }) => <MaterialIcons name={icon} size={size} color={color} />,
              tabBarBadge: key === 'messages' && unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
              tabBarBadgeStyle: { backgroundColor: theme.accent, color: theme.fg, fontSize: 10, fontWeight: '600' },
            }}
          />
        )
      })}
    </Tabs>
  )
}
