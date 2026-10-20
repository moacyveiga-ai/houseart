export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ app: 'houseart', commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null, env: process.env.VERCEL_ENV ?? 'local' })
}
