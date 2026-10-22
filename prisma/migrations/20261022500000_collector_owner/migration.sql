-- Collector as owner and seller (decision 2026-10-22): where a collector-registered artwork came from. Additive and reexecutable.
ALTER TABLE "Artwork" ADD COLUMN IF NOT EXISTS "acquisitionKind" TEXT;
ALTER TABLE "Artwork" ADD COLUMN IF NOT EXISTS "acquisitionYear" INTEGER;
ALTER TABLE "Artwork" ADD COLUMN IF NOT EXISTS "acquisitionFrom" TEXT;
ALTER TABLE "Artwork" ADD COLUMN IF NOT EXISTS "acquisitionNote" TEXT;
ALTER TABLE "Artwork" ADD COLUMN IF NOT EXISTS "acquisitionPriceCents" BIGINT;
