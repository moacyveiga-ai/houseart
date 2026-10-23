-- Real Stripe path (test/live mode, 2026-10-23): Stripe customer per user, mode of each saved card,
-- guarantee status of the offer hold and the processed webhook events. Additive and reexecutable.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerMode" TEXT;
ALTER TABLE "PaymentMethod" ADD COLUMN IF NOT EXISTS "providerMode" TEXT NOT NULL DEFAULT 'mock';
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "guaranteeStatus" TEXT;

CREATE TABLE IF NOT EXISTS "StripeEvent" (
  "id" SERIAL NOT NULL,
  "eventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "livemode" BOOLEAN NOT NULL DEFAULT false,
  "objectId" TEXT,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StripeEvent_eventId_key" ON "StripeEvent"("eventId");
