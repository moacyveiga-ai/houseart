-- Phase 4 (handoff 2026-10-21): guarantee/validity/quote on the offer, saved cards, Pix payout account. Additive and reexecutable.
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "validityHours" INTEGER NOT NULL DEFAULT 168,
ADD COLUMN IF NOT EXISTS "guaranteeMethod" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS "guaranteeRef" TEXT,
ADD COLUMN IF NOT EXISTS "paymentMethodId" INTEGER,
ADD COLUMN IF NOT EXISTS "deliveryCep" TEXT,
ADD COLUMN IF NOT EXISTS "shippingCents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "insuranceCents" BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "PaymentMethod" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CARD',
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "billingCep" TEXT,
    "providerRef" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaymentMethod_userId_status_idx" ON "PaymentMethod"("userId", "status");

CREATE TABLE IF NOT EXISTS "PayoutAccount" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "tenantId" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'PIX',
    "pixKeyType" TEXT NOT NULL,
    "pixKeyEnc" TEXT NOT NULL,
    "pixKeyMask" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayoutAccount_memberId_key" ON "PayoutAccount"("memberId");
CREATE INDEX IF NOT EXISTS "PayoutAccount_tenantId_idx" ON "PayoutAccount"("tenantId");
