// "Onboarding already seen" on this device (SecureStore, like the session token). Read failures = seen,
// so a broken store never traps the person in the onboarding.
import * as SecureStore from 'expo-secure-store'

const KEY = 'houseart.onboarding.v1'

export async function onboardingSeen(): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(KEY)) === '1' } catch { return true }
}

export async function markOnboardingSeen(): Promise<void> {
  try { await SecureStore.setItemAsync(KEY, '1') } catch { /* next launch shows it again */ }
}
