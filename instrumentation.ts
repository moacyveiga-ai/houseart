// Runs ONCE at server start, before any request.
//
// 1. Sets the PROCESS time zone. The explicit rule is lib/timezone.ts — this is
//    the floor: any call site not yet converted draws Brazilian time instead of
//    UTC (the Vercel default). A TZ that comes from the environment is NOT
//    honoured on purpose; use TZ_OVERRIDE to investigate a time-zone problem.
// 2. Server error report (lib/observability): every error the Next catches
//    becomes ONE sanitised JSON line (and an optional POST to a webhook).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { FUSO_BR } = await import('./lib/timezone')
  process.env.TZ = process.env.TZ_OVERRIDE || FUSO_BR
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
): Promise<void> {
  const { reportServerError } = await import('./lib/observability/report')
  await reportServerError(err, { method: request.method, path: request.path, routePath: context.routePath, routeType: context.routeType })
}
