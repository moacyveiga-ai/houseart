-- Admin review queue: the reason the staff wrote when deciding (audit 2026-10-25:
-- revoking a certificate happened with one click and left no reason). Additive.
ALTER TABLE "ReviewQueueItem" ADD COLUMN IF NOT EXISTS "decisionNote" TEXT;
