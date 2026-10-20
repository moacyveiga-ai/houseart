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
  '/collector/access',           // collector entry by e-mail code
  '/api/version',                // deploy probe
  '/privacy',
  '/robots.txt',
  '/verify',                     // public certificate verification: the code field (prefix '/verify/' covers the result)
  '/manifest.webmanifest',
])

const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/reset-password/',           // password link by token (legacy mode) — the token is the credential
  '/api/signup/',               // start/verify/resend of the member code
  '/api/collector/access/',     // start/verify/resend of the collector code — NARROW prefix: /api/collector/* stays logged
  '/api/jobs/',
  '/api/cron/',
  '/api/billing/webhook/stripe', // signed by Stripe (Stripe-Signature over the raw body)
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
 * root goes to the public market WITHOUT `next`; the collector area has its
 * own code-based door; the rest goes to /login with `next`.
 */
export function unauthenticatedDestination(pathname: string, search: string): { pathname: string; search: string } {
  if (pathname === '/') return { pathname: PUBLIC_HOME, search }
  const collectorArea = pathname === '/collector' || pathname.startsWith('/collector/')
  const next = new URLSearchParams({ next: pathname + search })
  return { pathname: collectorArea ? '/collector/access' : '/login', search: `?${next}` }
}
