-- Phase 7 (handoff 2026-10-21): public content — artist profile and curriculum, publications, gallery public profile and items, news, agenda. Additive and reexecutable.
-- CreateTable
CREATE TABLE IF NOT EXISTS "ArtistProfile" (
    "id" SERIAL NOT NULL,
    "artistId" INTEGER NOT NULL,
    "fullName" TEXT,
    "birthPlace" TEXT,
    "deathPlace" TEXT,
    "livesIn" TEXT,
    "nationality" TEXT,
    "representation" TEXT,
    "estateName" TEXT,
    "languagesJson" TEXT NOT NULL DEFAULT '[]',
    "quote" TEXT,
    "bio" TEXT,
    "photoUrl" TEXT,
    "photoCredit" TEXT,
    "royaltyBps" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ArtistEntry" (
    "id" SERIAL NOT NULL,
    "artistId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "venue" TEXT,
    "city" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArtistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Publication" (
    "id" SERIAL NOT NULL,
    "artistId" INTEGER,
    "tenantId" INTEGER,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meta" TEXT,
    "priceCents" BIGINT,
    "action" TEXT NOT NULL DEFAULT 'READ',
    "url" TEXT,
    "coverUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GalleryPublicProfile" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "uf" TEXT,
    "foundedYear" INTEGER,
    "summary" TEXT,
    "about" TEXT,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "street" TEXT,
    "district" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "coverUrl" TEXT,
    "websiteUrl" TEXT,
    "instagram" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "hours" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryPublicProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GalleryItem" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "url" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NewsArticle" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT,
    "imageUrl" TEXT,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgendaEvent" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "startsOn" TEXT NOT NULL,
    "endsOn" TEXT,
    "period" TEXT,
    "url" TEXT,
    "tenantId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgendaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ArtistProfile_artistId_key" ON "ArtistProfile"("artistId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ArtistEntry_artistId_kind_sortOrder_idx" ON "ArtistEntry"("artistId", "kind", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Publication_artistId_sortOrder_idx" ON "Publication"("artistId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Publication_tenantId_sortOrder_idx" ON "Publication"("tenantId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GalleryPublicProfile_tenantId_key" ON "GalleryPublicProfile"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GalleryPublicProfile_slug_key" ON "GalleryPublicProfile"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GalleryPublicProfile_uf_idx" ON "GalleryPublicProfile"("uf");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GalleryItem_tenantId_kind_sortOrder_idx" ON "GalleryItem"("tenantId", "kind", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NewsArticle_slug_key" ON "NewsArticle"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgendaEvent_startsOn_idx" ON "AgendaEvent"("startsOn");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArtistProfile_artistId_fkey') THEN
    ALTER TABLE "ArtistProfile" ADD CONSTRAINT "ArtistProfile_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArtistEntry_artistId_fkey') THEN
    ALTER TABLE "ArtistEntry" ADD CONSTRAINT "ArtistEntry_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Publication_artistId_fkey') THEN
    ALTER TABLE "Publication" ADD CONSTRAINT "Publication_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GalleryPublicProfile_tenantId_fkey') THEN
    ALTER TABLE "GalleryPublicProfile" ADD CONSTRAINT "GalleryPublicProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

