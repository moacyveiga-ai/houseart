// Web build (simulator): push to the phone does not exist in the browser.
import { useCallback } from 'react'
import { Alert } from 'react-native'

export function usePushToggle(): { on: boolean; busy: boolean; ready: boolean; toggle: (next: boolean) => Promise<void> } {
  const toggle = useCallback(async () => { Alert.alert('Avisos no celular', 'Só no aparelho: o simulador não recebe notificações.') }, [])
  return { on: false, busy: false, ready: true, toggle }
}
