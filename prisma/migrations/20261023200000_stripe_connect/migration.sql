-- Stripe Connect (2026-10-23): the seller's Express account and the transfer that pays each split line.
-- Additive and reexecutable.
CREATE TABLE IF NOT EXISTS "StripeConnectAccount" (
  "id" SERIAL NOT NULL,
  "memberId" INTEGER NOT NULL,
  "tenantId" INTEGER,
  "accountId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
  "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
  "requirementsJson" TEXT NOT NULL DEFAULT '[]',
  "disabledReason" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripeConnectAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StripeConnectAccount_memberId_key" ON "StripeConnectAccount"("memberId");
CREATE UNIQUE INDEX IF NOT EXISTS "StripeConnectAccount_accountId_key" ON "StripeConnectAccount"("accountId");
CREATE INDEX IF NOT EXISTS "StripeConnectAccount_tenantId_idx" ON "StripeConnectAccount"("tenantId");
CREATE INDEX IF NOT EXISTS "StripeConnectAccount_status_mode_idx" ON "StripeConnectAccount"("status", "mode");

ALTER TABLE "DealSplit" ADD COLUMN IF NOT EXISTS "transferredAt" TIMESTAMP(3);
ALTER TABLE "DealSplit" ADD COLUMN IF NOT EXISTS "payoutError" TEXT;
ALTER TABLE "DealSplit" ADD COLUMN IF NOT EXISTS "payoutAttempts" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "DealSplit_status_party_idx" ON "DealSplit"("status", "party");
