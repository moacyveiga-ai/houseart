// Web build: "onboarding seen" in localStorage (no secure store in the browser).
const KEY = 'houseart.app.onboarding.v1'

export async function onboardingSeen(): Promise<boolean> {
  try { return window.localStorage.getItem(KEY) === '1' } catch { return true }
}

export async function markOnboardingSeen(): Promise<void> {
  try { window.localStorage.setItem(KEY, '1') } catch { /* shows again next time */ }
}
