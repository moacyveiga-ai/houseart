-- Phase 3: mandates, offers, rounds/events, CRM contacts/opportunities, notifications. Additive and reexecutable.
-- CreateTable
CREATE TABLE IF NOT EXISTS "Mandate" (
    "id" SERIAL NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "tenantId" INTEGER,
    "listPriceCents" BIGINT NOT NULL,
    "reservePriceCents" BIGINT NOT NULL,
    "fixedPrice" BOOLEAN NOT NULL DEFAULT false,
    "autoNegotiatorOn" BOOLEAN NOT NULL DEFAULT false,
    "autoAcceptMinBps" INTEGER NOT NULL DEFAULT 9200,
    "acceptsTrade" BOOLEAN NOT NULL DEFAULT false,
    "shippingIncluded" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Offer" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "mandateId" INTEGER,
    "sellerMemberId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "tenantId" INTEGER,
    "buyerUserId" INTEGER,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerDocumentHash" TEXT,
    "buyerDocumentEnc" TEXT,
    "buyerDocumentMask" TEXT,
    "buyerKind" TEXT NOT NULL DEFAULT 'COLLECTOR',
    "buyerCity" TEXT,
    "offeredCents" BIGINT NOT NULL,
    "acceptedCents" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_OTP',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "otpHash" TEXT,
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "otpExpiresAt" TIMESTAMP(3),
    "retractionTokenHash" TEXT,
    "retractionIssuedAt" TIMESTAMP(3),
    "origin" TEXT NOT NULL DEFAULT 'MARKETPLACE',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OfferRound" (
    "id" SERIAL NOT NULL,
    "offerId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "author" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OfferEvent" (
    "id" SERIAL NOT NULL,
    "offerId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Contact" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "tenantId" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "documentHash" TEXT,
    "city" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "collectorProfileJson" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Opportunity" (
    "id" SERIAL NOT NULL,
    "contactId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "tenantId" INTEGER,
    "artworkId" INTEGER,
    "offerId" INTEGER,
    "stage" TEXT NOT NULL DEFAULT 'INTERESTED',
    "outcome" TEXT,
    "interest" TEXT,
    "valueCents" BIGINT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Mandate_artworkId_status_idx" ON "Mandate"("artworkId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Mandate_memberId_idx" ON "Mandate"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Offer_code_key" ON "Offer"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offer_artworkId_status_idx" ON "Offer"("artworkId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offer_memberId_status_idx" ON "Offer"("memberId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offer_tenantId_status_idx" ON "Offer"("tenantId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offer_buyerEmail_idx" ON "Offer"("buyerEmail");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offer_status_expiresAt_idx" ON "Offer"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OfferRound_offerId_number_key" ON "OfferRound"("offerId", "number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OfferEvent_offerId_createdAt_idx" ON "OfferEvent"("offerId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_memberId_idx" ON "Contact"("memberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_tenantId_documentHash_idx" ON "Contact"("tenantId", "documentHash");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_tenantId_email_key" ON "Contact"("tenantId", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Opportunity_memberId_stage_idx" ON "Opportunity"("memberId", "stage");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Opportunity_tenantId_stage_idx" ON "Opportunity"("tenantId", "stage");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Opportunity_contactId_idx" ON "Opportunity"("contactId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Mandate_artworkId_fkey') THEN
    ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Offer_artworkId_fkey') THEN
    ALTER TABLE "Offer" ADD CONSTRAINT "Offer_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Offer_mandateId_fkey') THEN
    ALTER TABLE "Offer" ADD CONSTRAINT "Offer_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OfferRound_offerId_fkey') THEN
    ALTER TABLE "OfferRound" ADD CONSTRAINT "OfferRound_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OfferEvent_offerId_fkey') THEN
    ALTER TABLE "OfferEvent" ADD CONSTRAINT "OfferEvent_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Opportunity_contactId_fkey') THEN
    ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Opportunity_artworkId_fkey') THEN
    ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Opportunity_offerId_fkey') THEN
    ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;


-- tenantId derived from memberId (Mandate, Offer, Contact, Opportunity) — same function as Artwork.
DROP TRIGGER IF EXISTS ha_tenant_derived ON "Mandate";
CREATE TRIGGER ha_tenant_derived BEFORE INSERT OR UPDATE OF "memberId" ON "Mandate" FOR EACH ROW EXECUTE FUNCTION ha_tenant_from_member_id();
DROP TRIGGER IF EXISTS ha_tenant_derived ON "Offer";
CREATE TRIGGER ha_tenant_derived BEFORE INSERT OR UPDATE OF "memberId" ON "Offer" FOR EACH ROW EXECUTE FUNCTION ha_tenant_from_member_id();
DROP TRIGGER IF EXISTS ha_tenant_derived ON "Contact";
CREATE TRIGGER ha_tenant_derived BEFORE INSERT OR UPDATE OF "memberId" ON "Contact" FOR EACH ROW EXECUTE FUNCTION ha_tenant_from_member_id();
DROP TRIGGER IF EXISTS ha_tenant_derived ON "Opportunity";
CREATE TRIGGER ha_tenant_derived BEFORE INSERT OR UPDATE OF "memberId" ON "Opportunity" FOR EACH ROW EXECUTE FUNCTION ha_tenant_from_member_id();
-- one ACTIVE mandate per artwork (partial unique index, only here — never `db push`)
CREATE UNIQUE INDEX IF NOT EXISTS "Mandate_artwork_active_key" ON "Mandate"("artworkId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS "Offer_retraction_token_key" ON "Offer"("retractionTokenHash") WHERE "retractionTokenHash" IS NOT NULL;
