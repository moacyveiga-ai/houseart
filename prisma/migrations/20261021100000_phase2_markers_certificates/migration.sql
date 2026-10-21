-- Phase 2: certificate versions/events/anchor, physical markers, orders, review queue. Additive and reexecutable.
-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "signatureJson" TEXT,
ADD COLUMN     "signedAt" TIMESTAMP(3),
ADD COLUMN     "signedByUserId" INTEGER,
ADD COLUMN     "timestampTokenRef" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CertificateVersion" (
    "id" SERIAL NOT NULL,
    "certificateId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "holderName" TEXT NOT NULL,
    "holderDocumentHash" TEXT,
    "holderDocumentMask" TEXT,
    "holderUserId" INTEGER,
    "contentJson" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "prevHash" TEXT,
    "signaturesJson" TEXT NOT NULL DEFAULT '[]',
    "timestampTokenRef" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfRef" TEXT,
    "pdfHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "CertificateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CertificateEvent" (
    "id" SERIAL NOT NULL,
    "certificateId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "hash" TEXT NOT NULL,
    "prevHash" TEXT,
    "actorUserId" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anchorDay" TEXT,

    CONSTRAINT "CertificateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DailyAnchor" (
    "id" SERIAL NOT NULL,
    "day" TEXT NOT NULL,
    "merkleRoot" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'NONE',
    "txRef" TEXT,
    "eventCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MarkerBatch" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "destination" TEXT NOT NULL,
    "tenantId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarkerBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PhysicalMarker" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "uid" TEXT NOT NULL,
    "keyRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STOCK',
    "artworkId" INTEGER,
    "orderId" INTEGER,
    "linkedAt" TIMESTAMP(3),
    "linkedByUserId" INTEGER,
    "readCounter" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "PhysicalMarker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MarkerRead" (
    "id" SERIAL NOT NULL,
    "markerId" INTEGER NOT NULL,
    "counter" INTEGER NOT NULL,
    "cmacValid" BOOLEAN NOT NULL,
    "tamperFlag" BOOLEAN NOT NULL DEFAULT false,
    "ipHash" TEXT,
    "userId" INTEGER,
    "purpose" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarkerRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MarkerOrder" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" BIGINT NOT NULL DEFAULT 1500,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "orderId" INTEGER,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarkerOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReviewQueueItem" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "artworkId" INTEGER,
    "tenantId" INTEGER,
    "reason" TEXT NOT NULL,
    "refId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "decidedByUserId" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CertificateVersion_certificateId_version_key" ON "CertificateVersion"("certificateId", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CertificateEvent_occurredAt_idx" ON "CertificateEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CertificateEvent_certificateId_seq_key" ON "CertificateEvent"("certificateId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DailyAnchor_day_key" ON "DailyAnchor"("day");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MarkerBatch_code_key" ON "MarkerBatch"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PhysicalMarker_uid_key" ON "PhysicalMarker"("uid");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PhysicalMarker_artworkId_key" ON "PhysicalMarker"("artworkId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PhysicalMarker_status_idx" ON "PhysicalMarker"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PhysicalMarker_orderId_idx" ON "PhysicalMarker"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarkerRead_markerId_createdAt_idx" ON "MarkerRead"("markerId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarkerOrder_memberId_status_idx" ON "MarkerOrder"("memberId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarkerOrder_status_idx" ON "MarkerOrder"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReviewQueueItem_status_createdAt_idx" ON "ReviewQueueItem"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReviewQueueItem_artworkId_idx" ON "ReviewQueueItem"("artworkId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CertificateVersion_certificateId_fkey') THEN
    ALTER TABLE "CertificateVersion" ADD CONSTRAINT "CertificateVersion_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CertificateEvent_certificateId_fkey') THEN
    ALTER TABLE "CertificateEvent" ADD CONSTRAINT "CertificateEvent_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PhysicalMarker_batchId_fkey') THEN
    ALTER TABLE "PhysicalMarker" ADD CONSTRAINT "PhysicalMarker_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MarkerBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MarkerRead_markerId_fkey') THEN
    ALTER TABLE "MarkerRead" ADD CONSTRAINT "MarkerRead_markerId_fkey" FOREIGN KEY ("markerId") REFERENCES "PhysicalMarker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

