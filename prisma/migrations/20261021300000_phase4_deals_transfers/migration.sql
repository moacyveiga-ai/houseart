-- Phase 4: deals (6 phases), splits, ownership transfers, royalties, KYC, insurance. Additive and reexecutable.
-- CreateTable
CREATE TABLE IF NOT EXISTS "Deal" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "offerId" INTEGER NOT NULL,
    "sellerMemberId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "tenantId" INTEGER,
    "buyerUserId" INTEGER NOT NULL,
    "market" TEXT NOT NULL DEFAULT 'PRIMARY',
    "amountCents" BIGINT NOT NULL,
    "shippingCents" BIGINT NOT NULL DEFAULT 0,
    "insuranceCents" BIGINT NOT NULL DEFAULT 0,
    "phase" TEXT NOT NULL DEFAULT 'OFFER_ACCEPTED',
    "exceptionStatus" TEXT,
    "escrowPaymentRef" TEXT,
    "escrowPaidAt" TIMESTAMP(3),
    "sellerSignedAt" TIMESTAMP(3),
    "buyerSignedAt" TIMESTAMP(3),
    "carrierName" TEXT,
    "trackingCode" TEXT,
    "insurerName" TEXT,
    "policyRef" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveryMarkerReadId" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DealPhaseEvent" (
    "id" SERIAL NOT NULL,
    "dealId" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actorKind" TEXT NOT NULL DEFAULT 'SYSTEM',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealPhaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DealSplit" (
    "id" SERIAL NOT NULL,
    "dealId" INTEGER NOT NULL,
    "party" TEXT NOT NULL,
    "bps" INTEGER NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "payoutRef" TEXT,

    CONSTRAINT "DealSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OwnershipTransfer" (
    "id" SERIAL NOT NULL,
    "certificateId" INTEGER NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "dealId" INTEGER,
    "fromUserId" INTEGER NOT NULL,
    "toUserId" INTEGER,
    "toName" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toDocumentHash" TEXT,
    "toDocumentEnc" TEXT,
    "toDocumentMask" TEXT,
    "priceCents" BIGINT,
    "priceSealed" BOOLEAN NOT NULL DEFAULT false,
    "sealedPriceHash" TEXT,
    "royaltyCents" BIGINT NOT NULL DEFAULT 0,
    "feeCents" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "inviteTokenHash" TEXT,
    "inviteIssuedAt" TIMESTAMP(3),
    "kycStatus" TEXT,
    "sellerSignedAt" TIMESTAMP(3),
    "buyerSignedAt" TIMESTAMP(3),
    "feePaidAt" TIMESTAMP(3),
    "feePaymentRef" TEXT,
    "tapMarkerReadId" INTEGER,
    "completedAt" TIMESTAMP(3),
    "newVersionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RoyaltyPayment" (
    "id" SERIAL NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "artistId" INTEGER NOT NULL,
    "transferId" INTEGER,
    "dealId" INTEGER,
    "saleCents" BIGINT NOT NULL,
    "previousSaleCents" BIGINT NOT NULL,
    "appreciationCents" BIGINT NOT NULL,
    "royaltyCents" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "receiptRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoyaltyPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KycVerification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "documentHash" TEXT,
    "biometricScoreBps" INTEGER,
    "pepHit" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InsurancePolicy" (
    "id" SERIAL NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "coverageCents" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Deal_code_key" ON "Deal"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Deal_offerId_key" ON "Deal"("offerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Deal_memberId_phase_idx" ON "Deal"("memberId", "phase");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Deal_tenantId_phase_idx" ON "Deal"("tenantId", "phase");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Deal_buyerUserId_phase_idx" ON "Deal"("buyerUserId", "phase");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DealPhaseEvent_dealId_occurredAt_idx" ON "DealPhaseEvent"("dealId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DealSplit_dealId_idx" ON "DealSplit"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OwnershipTransfer_dealId_key" ON "OwnershipTransfer"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OwnershipTransfer_inviteTokenHash_key" ON "OwnershipTransfer"("inviteTokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OwnershipTransfer_fromUserId_status_idx" ON "OwnershipTransfer"("fromUserId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OwnershipTransfer_toUserId_status_idx" ON "OwnershipTransfer"("toUserId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OwnershipTransfer_artworkId_idx" ON "OwnershipTransfer"("artworkId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RoyaltyPayment_dealId_key" ON "RoyaltyPayment"("dealId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoyaltyPayment_artistId_status_idx" ON "RoyaltyPayment"("artistId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KycVerification_userId_status_idx" ON "KycVerification"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InsurancePolicy_artworkId_status_idx" ON "InsurancePolicy"("artworkId", "status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_artworkId_fkey') THEN
    ALTER TABLE "Deal" ADD CONSTRAINT "Deal_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_offerId_fkey') THEN
    ALTER TABLE "Deal" ADD CONSTRAINT "Deal_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DealPhaseEvent_dealId_fkey') THEN
    ALTER TABLE "DealPhaseEvent" ADD CONSTRAINT "DealPhaseEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DealSplit_dealId_fkey') THEN
    ALTER TABLE "DealSplit" ADD CONSTRAINT "DealSplit_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OwnershipTransfer_artworkId_fkey') THEN
    ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OwnershipTransfer_dealId_fkey') THEN
    ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RoyaltyPayment_artworkId_fkey') THEN
    ALTER TABLE "RoyaltyPayment" ADD CONSTRAINT "RoyaltyPayment_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RoyaltyPayment_dealId_fkey') THEN
    ALTER TABLE "RoyaltyPayment" ADD CONSTRAINT "RoyaltyPayment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InsurancePolicy_artworkId_fkey') THEN
    ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;


DROP TRIGGER IF EXISTS ha_tenant_derived ON "Deal";
CREATE TRIGGER ha_tenant_derived BEFORE INSERT OR UPDATE OF "memberId" ON "Deal" FOR EACH ROW EXECUTE FUNCTION ha_tenant_from_member_id();
