// Regras de ofertas as a screen of its own (the deep link of the panel and the
// prototype's "Regras de ofertas"); the same section lives in the Negócios tab.
import { useCallback, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RulesSection } from '@/screens/gallery/RulesSection'
import { ROLE_REASONS, rolePermissions } from '@/screens/gallery/role-core'
import { useSession } from '@/auth/session'
import { Text } from 'react-native'
import { theme } from '@/theme'
import { Toast, TopBar } from '@/ui/kit'

export default function Screen() {
  const insets = useSafeAreaInsets()
  // Only the gallery's Admin changes the rules (the server refuses the rest): Vendas and Acervo get the reason.
  const canManage = rolePermissions(useSession().me?.teamRole).manageRules
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <TopBar title="Regras de ofertas" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>{canManage ? <RulesSection onToast={setToast} /> : <Text style={{ fontSize: 14, lineHeight: 20, color: theme.fgBody }}>{ROLE_REASONS.rules}</Text>}</ScrollView>
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}
