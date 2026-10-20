// Prisma client — Postgres in EVERY environment (pure decision in
// lib/prisma-url.ts). Only the `pg` adapter: local Postgres, CI, Supabase.
//
// LAZY INSTANTIATION (ported from the Housebroker, revision 2026-09-06): the
// `next build` imports the route modules while "Collecting page data", and
// every module that imports `prisma` pulls this one. The exported `prisma` is
// the two-level Proxy of lib/prisma-lazy.ts: `prisma.artwork` opens nothing;
// the real client is born on `prisma.artwork.findMany(…)` (or a `$…` method),
// i.e. on the first real query. The build has, and needs, no database.
//
// SCOPE EXTENSION: the real client is born already extended with
// lib/scope/extension.ts, which refuses (dev/test) or logs (production) a hot
// list queried without an owner key inside a scoped context. Applied HERE, on
// the real client and before the lazy Proxy, so it also holds inside
// `$transaction`. The extended client is returned AS `PrismaClient` on
// purpose: the extension is `query` only, the type surface is the same.
import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { classifyDatabaseUrl, DATABASE_URL_ERROR } from '@/lib/prisma-url'
import { createLazyClient } from '@/lib/prisma-lazy'
import { scopeExtension } from '@/lib/scope/extension'
import { attachJobLeaseDb } from '@/lib/job-lease/server'

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? ''
  if (classifyDatabaseUrl(url) === 'error') throw new Error(DATABASE_URL_ERROR)
  const adapter = new PrismaPg({ connectionString: url.trim() })
  return new PrismaClient({ adapter }).$extends(scopeExtension) as unknown as PrismaClient
}

type Client = PrismaClient

// Singleton on globalThis: survives HMR in dev, and avoids two instances if the
// bundler duplicates the module. What lives in the global is the REAL client.
const globalForPrisma = globalThis as unknown as { prisma?: Client }

export const prisma: Client = createLazyClient<Client>(() => {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createPrismaClient()
  return globalForPrisma.prisma
})

// The job lease (lib/job-lease) receives the client by injection: importing
// lib/prisma from there would create an import cycle. Attaching the Proxy
// opens no connection.
attachJobLeaseDb(prisma)
