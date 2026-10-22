-- Phase 6 (handoff 2026-10-21): gallery operation — offer rules, team invites, artist contracts, listing pause, daily views. Additive and reexecutable.
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "role" TEXT;
ALTER TABLE "Artwork" ADD COLUMN IF NOT EXISTS "listingPausedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "OfferRules" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "tenantId" INTEGER,
    "refuseLow" BOOLEAN NOT NULL DEFAULT true,
    "refuseBelowBps" INTEGER NOT NULL DEFAULT 7000,
    "autoAcceptOn" BOOLEAN NOT NULL DEFAULT false,
    "autoAcceptMinBps" INTEGER NOT NULL DEFAULT 9500,
    "responseHours" INTEGER NOT NULL DEFAULT 48,
    "notifyTeam" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OfferRules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OfferRules_memberId_key" ON "OfferRules"("memberId");
CREATE INDEX IF NOT EXISTS "OfferRules_tenantId_idx" ON "OfferRules"("tenantId");

CREATE TABLE IF NOT EXISTS "TeamInvite" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedByUserId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TeamInvite_tokenHash_key" ON "TeamInvite"("tokenHash");
CREATE INDEX IF NOT EXISTS "TeamInvite_tenantId_status_idx" ON "TeamInvite"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "ArtistContract" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "artistId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'REPRESENTED',
    "galleryBps" INTEGER NOT NULL DEFAULT 5000,
    "validUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArtistContract_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ArtistContract_tenantId_artistId_key" ON "ArtistContract"("tenantId", "artistId");

CREATE TABLE IF NOT EXISTS "ArtworkViewDay" (
    "id" SERIAL NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ArtworkViewDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ArtworkViewDay_artworkId_day_key" ON "ArtworkViewDay"("artworkId", "day");
