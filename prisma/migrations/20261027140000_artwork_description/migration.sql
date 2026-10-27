-- "Sobre a obra" of the public artwork page, written by whoever registers it (audit público §… "Sobre a obra").
ALTER TABLE "Artwork" ADD COLUMN IF NOT EXISTS "description" TEXT;
