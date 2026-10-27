-- "Embalagem e condition report" (audit galeria §4): the seller's condition note and photos of the packed work, before shipping.
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "conditionReport" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "packedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "DealPackagingPhoto" (
  "id" SERIAL NOT NULL,
  "dealId" INTEGER NOT NULL,
  "fileRef" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealPackagingPhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DealPackagingPhoto_dealId_idx" ON "DealPackagingPhoto"("dealId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DealPackagingPhoto_dealId_fkey') THEN
    ALTER TABLE "DealPackagingPhoto" ADD CONSTRAINT "DealPackagingPhoto_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
