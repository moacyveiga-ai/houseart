// Web build: the simulator runs on the same origin as the API, and the web journeys open
// in an iframe that rides on the browser's own session cookie (HttpOnly, set by the web
// login). JavaScript cannot set or clear that cookie, so these are no-ops.
export async function setSessionCookie(_token: string): Promise<void> { /* see header */ }
export async function clearSessionCookies(): Promise<void> { /* see header */ }
