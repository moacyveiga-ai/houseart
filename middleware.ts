// middleware.ts — protects every route except the allowlist in
// lib/public-routes.ts (pure module with its own test). Runs on the Edge
// runtime: no Prisma. What is decided HERE is only the PRESENCE of the session
// cookie; the real validation (user exists? active? profile?) happens in the
// routes and Server Components through getSession().
// Stays `middleware.ts` (not `proxy.ts`): Next 16 does not run the edge
// runtime in `proxy`, and this file is Edge by design.
import { NextRequest, NextResponse } from 'next/server'
import { isPublicRoute, unauthenticatedDestination } from '@/lib/public-routes'

const COOKIE_NAME = 'houseart_session'

function noSession(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
  }
  const url = req.nextUrl.clone()
  const dest = unauthenticatedDestination(pathname, req.nextUrl.search)
  url.pathname = dest.pathname
  url.search = dest.search
  return NextResponse.redirect(url)
}

// Trackable link of a member: /e/...?ref={slug} writes the attribution cookie
// (90 days). The slug is validated server-side when the offer is created.
function withAttributionCookie(req: NextRequest, res: NextResponse): NextResponse {
  const { pathname } = req.nextUrl
  const ref = req.nextUrl.searchParams.get('ref')
  if (ref && (pathname === '/e' || pathname.startsWith('/e/'))) {
    res.cookies.set('houseart_ref', ref.slice(0, 80), { maxAge: 90 * 24 * 3600, path: '/', sameSite: 'lax' })
  }
  return res
}

/** The panel layout reads `x-pathname` to light the active nav item (a layout has no pathname). */
function next(req: NextRequest): NextResponse {
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', req.nextUrl.pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (isPublicRoute(pathname)) return withAttributionCookie(req, next(req))
  const has = !!req.cookies.get(COOKIE_NAME)?.value
  if (has) return next(req)
  return noSession(req)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map|woff2)$).*)'],
}
