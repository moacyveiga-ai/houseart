// PURE core of the middleware allowlist: no next, no prisma, no env — a test
// can ask "does this route pass without a cookie?" without a server. The I/O
// (read the cookie, redirect) lives in middleware.ts.
//
// Crons and jobs are ALWAYS allowed by prefix, never route by route (in the
// Housebroker the per-route list rotted and knocked 9 crons down). "Public"
// here is only at the middleware: every route under those prefixes calls
// `authorizeJob()`, which demands the CRON_SECRET bearer and fails closed.

const PUBLIC_EXACT = new Set<string>([
  '/login',
  '/recover-password',
  '/reset-password',
  '/signup',                     // member signup (artist, gallery, advisor) by e-mail code
  '/api/version',                // deploy probe
  '/api/stripe/webhook',         // signed by Stripe (Stripe-Signature over the raw body, checked in lib/stripe/webhook-server.ts)
  '/privacy',
  '/terms',
  '/robots.txt',
  '/sitemap.xml',
  '/verify',                     // public certificate verification: the code field (prefix '/verify/' covers the result)
  '/manifest.webmanifest',
  '/install',                    // "Instalar o app" (PWA): the link the team sends
  '/design-system',              // the DS gallery (handoff Fase 1): no data, compared with the prototype
  '/simulator',                  // the native app in a phone frame (the app logs in by itself)
  '/app',                        // the native app exported for the web (public/app)
])

const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/reset-password/',           // password link by token (legacy mode) — the token is the credential
  '/api/signup/',               // start/verify/resend of the member code
  '/api/jobs/',
  '/api/cron/',
  '/api/kyc/webhook/',           // signed by the KYC provider
  '/api/whatsapp-evolution/webhook/',
  '/api/whatsapp-business/webhook/',
  '/api/partners/v1/',          // service-to-service, HMAC per partner AT THE ROUTE
  '/api/public/',               // public channels: offers with OTP, artwork views, contest a certificate
  '/api/v1/certificates/',      // public certificate lookup (machine readable)
  '/api/tools/',                // Tool Gateway of the HouseAgentic: HMAC, no cookie
  '/e',                         // public market: home, artwork page, artist page (prefix covers '/e/…')
  '/verify/',                   // public certificate verification result
  '/a/',                        // NFC marker landing: /a/[publicId]?uid&ctr&cmac
  '/sign/',                     // public e-signature link (assignment, consignment)
  '/api/signatures/',           // public signature API (sign/refuse/OTP by token)
  '/transfer/',                 // buyer side of an off-platform transfer (invite by token)
  '/api/transfer/',
  '/_next/',
  '/app/',                      // the app simulator's bundle and routes (it logs in by bearer, never by cookie)
  '/favicon',
  '/.well-known/',
]

/** `true` if the middleware lets it pass without a session cookie. */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

/** The home of who is NOT logged in: the public market. */
export const PUBLIC_HOME = '/e'

/**
 * Where someone without a session goes when hitting a protected route. The
 * root goes to the public market WITHOUT `next`; the rest goes to /login with
 * `next`. (The collector once had a door of its own at /collector/access; the
 * page never shipped — the collector enters by /login like everyone — and the
 * dead door sent them to a 404.)
 */
export function unauthenticatedDestination(pathname: string, search: string): { pathname: string; search: string } {
  // `/` without a session is the public Home (handoff Fase 7).
  if (pathname === '/') return { pathname: PUBLIC_HOME, search: '' }
  const next = new URLSearchParams({ next: pathname + search })
  return { pathname: '/login', search: `?${next}` }
}
