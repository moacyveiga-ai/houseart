// Regras de ofertas as a screen of its own (the deep link of the panel and the
// prototype's "Regras de ofertas"); the same section lives in the Negócios tab.
import { useCallback, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RulesSection } from '@/screens/gallery/RulesSection'
import { theme } from '@/theme'
import { Toast, TopBar } from '@/ui/kit'

export default function Screen() {
  const insets = useSafeAreaInsets()
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <TopBar title="Regras de ofertas" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}><RulesSection onToast={setToast} /></ScrollView>
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}
