-- HouseArt baseline (Fase 0): Tenant, User, Session, JobLease. Additive and
-- reexecutable (IF NOT EXISTS / pg_constraint guards).
CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" SERIAL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "document" TEXT,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_document_key" ON "Tenant"("document");
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX IF NOT EXISTS "Tenant_status_idx" ON "Tenant"("status");

CREATE TABLE IF NOT EXISTS "User" (
  "id" SERIAL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "cpf" TEXT,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT,
  "profile" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "memberId" INTEGER,
  "tenantId" INTEGER,
  "tenantRole" TEXT,
  "authProviderId" TEXT,
  "recoverySessionId" TEXT,
  "recoverySessionUntil" TIMESTAMP(3),
  "collectorVerifiedAt" TIMESTAMP(3),
  "deletionRequestedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_cpf_key" ON "User"("cpf");
CREATE UNIQUE INDEX IF NOT EXISTS "User_memberId_key" ON "User"("memberId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_authProviderId_key" ON "User"("authProviderId");
CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX IF NOT EXISTS "User_profile_active_idx" ON "User"("profile", "active");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_tenantId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Session" (
  "id" SERIAL PRIMARY KEY,
  "token" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "JobLease" (
  "name" TEXT PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "lockedUntil" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
