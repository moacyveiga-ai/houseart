-- The gallery's team on the public page (audit público "Responsáveis"): bio, e-mail and phone of each person.
ALTER TABLE "GalleryItem" ADD COLUMN IF NOT EXISTS "body" TEXT;
ALTER TABLE "GalleryItem" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "GalleryItem" ADD COLUMN IF NOT EXISTS "phone" TEXT;
