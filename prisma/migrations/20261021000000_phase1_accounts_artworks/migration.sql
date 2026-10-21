-- Phase 1: accounts, profiles, members, artists, artworks, duplicate checks, certificate shell.
-- Additive and reexecutable.
-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "activeProfileKind" TEXT,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AccessCode" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resends" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "payloadEnc" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" SERIAL NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "userId" INTEGER,
    "userName" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'ui',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "rate_limit_bucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_bucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Member" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "tenantId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "city" TEXT,
    "uf" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "approvedAt" TIMESTAMP(3),
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Artist" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER,
    "tenantId" INTEGER,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "birthYear" INTEGER,
    "deathYear" INTEGER,
    "heirsJson" TEXT NOT NULL DEFAULT '[]',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GalleryProfile" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "cnpjEnc" TEXT,
    "cnpjHash" TEXT,
    "cnpjMask" TEXT,
    "addressJson" TEXT NOT NULL DEFAULT '{}',
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Artwork" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER,
    "memberId" INTEGER NOT NULL,
    "artistId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "technique" TEXT,
    "materials" TEXT,
    "heightMm" INTEGER,
    "widthMm" INTEGER,
    "depthMm" INTEGER,
    "edition" TEXT,
    "signatureLocation" TEXT,
    "series" TEXT,
    "category" TEXT NOT NULL DEFAULT 'PAINTING',
    "conditionGrade" TEXT,
    "conditionBy" TEXT,
    "conditionAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "market" TEXT,
    "saleMode" TEXT,
    "listPriceCents" BIGINT,
    "priceSealed" BOOLEAN NOT NULL DEFAULT false,
    "publicId" TEXT,
    "seal" TEXT NOT NULL DEFAULT 'NONE',
    "sealIssuedAt" TIMESTAMP(3),
    "coverMediaId" INTEGER,
    "wizardStep" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ArtworkMedia" (
    "id" SERIAL NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "masterRef" TEXT NOT NULL,
    "publicUrl" TEXT,
    "sha256" TEXT NOT NULL,
    "pHash" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "quality" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtworkMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ArtworkConditionRegion" (
    "id" SERIAL NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "region" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'INTACT',

    CONSTRAINT "ArtworkConditionRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ArtworkHistoryItem" (
    "id" SERIAL NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArtworkHistoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ArtworkOwner" (
    "id" SERIAL NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "partyName" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "documentEnc" TEXT NOT NULL,
    "documentMask" TEXT NOT NULL,
    "shareBps" INTEGER NOT NULL DEFAULT 10000,
    "userId" INTEGER,

    CONSTRAINT "ArtworkOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DuplicateCheck" (
    "id" SERIAL NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "candidateArtworkId" INTEGER NOT NULL,
    "similarityBps" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'PHASH',
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedByUserId" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicateCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Certificate" (
    "id" SERIAL NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "publicId" TEXT,
    "currentVersionId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "stage" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserProfile_userId_kind_key" ON "UserProfile"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AccessCode_tokenHash_key" ON "AccessCode"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccessCode_email_createdAt_idx" ON "AccessCode"("email", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rate_limit_bucket_updatedAt_idx" ON "rate_limit_bucket"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Member_userId_key" ON "Member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Member_slug_key" ON "Member"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Member_tenantId_status_idx" ON "Member"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Artist_memberId_key" ON "Artist"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Artist_slug_key" ON "Artist"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Artist_tenantId_idx" ON "Artist"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GalleryProfile_tenantId_key" ON "GalleryProfile"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Artwork_publicId_key" ON "Artwork"("publicId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Artwork_tenantId_status_idx" ON "Artwork"("tenantId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Artwork_memberId_status_idx" ON "Artwork"("memberId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Artwork_artistId_idx" ON "Artwork"("artistId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Artwork_status_createdAt_idx" ON "Artwork"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ArtworkMedia_artworkId_kind_key" ON "ArtworkMedia"("artworkId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ArtworkConditionRegion_artworkId_region_key" ON "ArtworkConditionRegion"("artworkId", "region");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ArtworkOwner_artworkId_documentHash_key" ON "ArtworkOwner"("artworkId", "documentHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DuplicateCheck_artworkId_decision_idx" ON "DuplicateCheck"("artworkId", "decision");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_artworkId_key" ON "Certificate"("artworkId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_publicId_key" ON "Certificate"("publicId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserProfile_userId_fkey') THEN
    ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Member_userId_fkey') THEN
    ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Member_tenantId_fkey') THEN
    ALTER TABLE "Member" ADD CONSTRAINT "Member_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Artist_memberId_fkey') THEN
    ALTER TABLE "Artist" ADD CONSTRAINT "Artist_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GalleryProfile_tenantId_fkey') THEN
    ALTER TABLE "GalleryProfile" ADD CONSTRAINT "GalleryProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Artwork_memberId_fkey') THEN
    ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Artwork_artistId_fkey') THEN
    ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArtworkMedia_artworkId_fkey') THEN
    ALTER TABLE "ArtworkMedia" ADD CONSTRAINT "ArtworkMedia_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArtworkConditionRegion_artworkId_fkey') THEN
    ALTER TABLE "ArtworkConditionRegion" ADD CONSTRAINT "ArtworkConditionRegion_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArtworkHistoryItem_artworkId_fkey') THEN
    ALTER TABLE "ArtworkHistoryItem" ADD CONSTRAINT "ArtworkHistoryItem_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArtworkOwner_artworkId_fkey') THEN
    ALTER TABLE "ArtworkOwner" ADD CONSTRAINT "ArtworkOwner_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DuplicateCheck_artworkId_fkey') THEN
    ALTER TABLE "DuplicateCheck" ADD CONSTRAINT "DuplicateCheck_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DuplicateCheck_candidateArtworkId_fkey') THEN
    ALTER TABLE "DuplicateCheck" ADD CONSTRAINT "DuplicateCheck_candidateArtworkId_fkey" FOREIGN KEY ("candidateArtworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Certificate_artworkId_fkey') THEN
    ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;



-- ── tenantId derived by trigger (ADR-010 port): Artwork from Member; User from Member ──
CREATE OR REPLACE FUNCTION ha_tenant_of_member_id(mid INTEGER) RETURNS INTEGER AS $$
  SELECT "tenantId" FROM "Member" WHERE "id" = mid
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION ha_tenant_from_member_id() RETURNS trigger AS $$
BEGIN
  IF NEW."memberId" IS NOT NULL THEN
    NEW."tenantId" := ha_tenant_of_member_id(NEW."memberId");
  ELSE
    NEW."tenantId" := NULL;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ha_tenant_derived ON "Artwork";
CREATE TRIGGER ha_tenant_derived BEFORE INSERT OR UPDATE OF "memberId" ON "Artwork"
  FOR EACH ROW EXECUTE FUNCTION ha_tenant_from_member_id();

CREATE OR REPLACE FUNCTION ha_tenant_user_from_member() RETURNS trigger AS $$
BEGIN
  IF NEW."tenantId" IS NULL AND NEW."memberId" IS NOT NULL THEN
    NEW."tenantId" := ha_tenant_of_member_id(NEW."memberId");
    IF NEW."tenantRole" IS NULL THEN NEW."tenantRole" := 'MEMBER'; END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ha_tenant_user_from_member ON "User";
CREATE TRIGGER ha_tenant_user_from_member BEFORE INSERT OR UPDATE OF "memberId" ON "User"
  FOR EACH ROW EXECUTE FUNCTION ha_tenant_user_from_member();
