-- Pix and boleto for the escrow of a deal (checkout of the prototype: Pix · Cartão · Boleto). Additive.
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "escrowMethod" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "escrowPendingRef" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "escrowExpiresAt" TIMESTAMP(3);
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "escrowInstructionsJson" TEXT;
CREATE INDEX IF NOT EXISTS "Deal_escrowPendingRef_idx" ON "Deal"("escrowPendingRef");
