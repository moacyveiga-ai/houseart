import { NextResponse } from 'next/server'

/** The URL encoded in the tag/QR: `/a/[publicId]?uid&ctr&cmac` → the verification page keeps the SUN query. */
export function GET(req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  return ctx.params.then((p) => {
    const url = new URL(req.url)
    return NextResponse.redirect(new URL(`/verify/${encodeURIComponent(p.publicId)}${url.search}`, req.url), 307)
  })
}
