-- Phase 5: plans, orders, invoices and appraisals (queue, signed report, comparables). Additive and reexecutable.
-- CreateTable
CREATE TABLE IF NOT EXISTS "Plan" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "priceCents" BIGINT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlanFeature" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "limit" INTEGER,

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlanSubscription" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ServiceCatalog" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" BIGINT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'UNIT',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServiceCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Order" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" INTEGER,
    "memberId" INTEGER,
    "userId" INTEGER,
    "payerKind" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amountCents" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "provider" TEXT NOT NULL DEFAULT 'STRIPE',
    "paymentRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "artworkId" INTEGER,
    "dealId" INTEGER,
    "appraisalRequestId" INTEGER,
    "transferId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER,
    "userId" INTEGER,
    "kind" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "fiscalDocumentRef" TEXT,
    "orderId" INTEGER,
    "dealId" INTEGER,
    "subscriptionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppraisalRequest" (
    "id" SERIAL NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "tenantId" INTEGER,
    "memberId" INTEGER,
    "requestedByUserId" INTEGER NOT NULL,
    "requesterLabel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "dueOn" TIMESTAMP(3) NOT NULL,
    "assignedAppraiserId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "orderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppraisalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Appraisal" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "artworkId" INTEGER NOT NULL,
    "appraiserUserId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "minCents" BIGINT NOT NULL,
    "suggestedCents" BIGINT NOT NULL,
    "maxCents" BIGINT NOT NULL,
    "methodology" TEXT NOT NULL,
    "comparablesJson" TEXT NOT NULL DEFAULT '[]',
    "contentHash" TEXT NOT NULL,
    "signatureJson" TEXT,
    "verificationCode" TEXT NOT NULL,
    "pdfRef" TEXT,
    "pdfHash" TEXT,
    "signedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appraisal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppraisalComparable" (
    "id" SERIAL NOT NULL,
    "artistId" INTEGER NOT NULL,
    "appraisalId" INTEGER,
    "label" TEXT NOT NULL,
    "dimensions" TEXT,
    "technique" TEXT,
    "priceCents" BIGINT NOT NULL,
    "soldOn" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppraisalComparable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlanFeature_planId_key_key" ON "PlanFeature"("planId", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlanSubscription_tenantId_status_idx" ON "PlanSubscription"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceCatalog_code_key" ON "ServiceCatalog"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Order_code_key" ON "Order"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_tenantId_status_idx" ON "Order"("tenantId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_tenantId_date_idx" ON "Invoice"("tenantId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_userId_date_idx" ON "Invoice"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppraisalRequest_orderId_key" ON "AppraisalRequest"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppraisalRequest_status_dueOn_idx" ON "AppraisalRequest"("status", "dueOn");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppraisalRequest_artworkId_idx" ON "AppraisalRequest"("artworkId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Appraisal_requestId_key" ON "Appraisal"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Appraisal_verificationCode_key" ON "Appraisal"("verificationCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Appraisal_artworkId_idx" ON "Appraisal"("artworkId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppraisalComparable_artistId_soldOn_idx" ON "AppraisalComparable"("artistId", "soldOn");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanFeature_planId_fkey') THEN
    ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanSubscription_tenantId_fkey') THEN
    ALTER TABLE "PlanSubscription" ADD CONSTRAINT "PlanSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanSubscription_planId_fkey') THEN
    ALTER TABLE "PlanSubscription" ADD CONSTRAINT "PlanSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_orderId_fkey') THEN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppraisalRequest_artworkId_fkey') THEN
    ALTER TABLE "AppraisalRequest" ADD CONSTRAINT "AppraisalRequest_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appraisal_requestId_fkey') THEN
    ALTER TABLE "Appraisal" ADD CONSTRAINT "Appraisal_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AppraisalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppraisalComparable_artistId_fkey') THEN
    ALTER TABLE "AppraisalComparable" ADD CONSTRAINT "AppraisalComparable_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;


-- one live subscription per tenant (partial unique index, only here — never `db push`)
CREATE UNIQUE INDEX IF NOT EXISTS "PlanSubscription_tenant_active_key" ON "PlanSubscription"("tenantId") WHERE "status" IN ('ACTIVE', 'PAST_DUE');
-- one DRAFT appraisal per request is guaranteed by requestId @unique; one ISSUED per artwork at a time:
CREATE UNIQUE INDEX IF NOT EXISTS "Appraisal_artwork_issued_key" ON "Appraisal"("artworkId") WHERE "status" = 'ISSUED';

-- plan catalog (D.16) — prices in cents, editable by staff later
INSERT INTO "Plan" ("code", "name", "description", "audience", "priceCents") VALUES
  ('ARTIST_FREE', 'Artista', 'Até 10 obras cadastradas, certificação avulsa e marketplace.', 'ARTIST', 0),
  ('ARTIST_STUDIO', 'Ateliê', 'Até 60 obras, 10 etiquetas incluídas por ano, 1 laudo incluído e destaque no marketplace.', 'ARTIST', 4900),
  ('GALLERY', 'Galeria', 'Inventário ilimitado, 15 certificações por mês, 3 viewing rooms e 3 assentos.', 'GALLERY', 34900),
  ('GALLERY_PRO', 'Galeria Pro', 'Multiusuário, API, relatórios, 40 certificações por mês, 10 viewing rooms e 5 assentos.', 'GALLERY', 89900),
  ('ADVISOR', 'Consultor', 'Clientes, propostas em nome deles, 10 certificações por mês e 2 viewing rooms.', 'ADVISOR', 14900)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "PlanFeature" ("planId", "key", "limit")
SELECT p."id", f."key", f."limit" FROM (VALUES
  ('ARTIST_FREE', 'ARTWORKS', 10), ('ARTIST_FREE', 'TAGS_INCLUDED', 0), ('ARTIST_FREE', 'APPRAISALS_INCLUDED', 0),
  ('ARTIST_STUDIO', 'ARTWORKS', 60), ('ARTIST_STUDIO', 'TAGS_INCLUDED', 10), ('ARTIST_STUDIO', 'APPRAISALS_INCLUDED', 1),
  ('GALLERY', 'CERTIFICATIONS_MONTH', 15), ('GALLERY', 'VIEWING_ROOMS', 3), ('GALLERY', 'SEATS', 3),
  ('GALLERY_PRO', 'CERTIFICATIONS_MONTH', 40), ('GALLERY_PRO', 'VIEWING_ROOMS', 10), ('GALLERY_PRO', 'SEATS', 5),
  ('ADVISOR', 'CERTIFICATIONS_MONTH', 10), ('ADVISOR', 'VIEWING_ROOMS', 2), ('ADVISOR', 'SEATS', 1)
) AS f("code", "key", "limit") JOIN "Plan" p ON p."code" = f."code"
ON CONFLICT ("planId", "key") DO NOTHING;

-- service catalog (D.15)
INSERT INTO "ServiceCatalog" ("code", "name", "description", "priceCents", "unit") VALUES
  ('CERTIFICATION', 'Certificação', 'Etiqueta NFC + certificado-escritura assinado.', 14900, 'UNIT'),
  ('CERTIFICATION_BATCH', 'Certificação em lote', 'A partir de 10 obras.', 9900, 'UNIT'),
  ('RECERTIFICATION', 'Recertificação', 'Nova etiqueta e nova versão do certificado.', 4900, 'UNIT'),
  ('TAG_KIT', 'Etiqueta NFC avulsa', 'Kit de etiquetas NTAG 424 DNA.', 1500, 'UNIT'),
  ('OFFPLATFORM_TRANSFER', 'Transferência fora da plataforma', 'Registro da nova titularidade com assinaturas e toque.', 19900, 'UNIT'),
  ('APPRAISAL_SIGNED', 'Laudo de opinião de valor', 'Laudo assinado por avaliador credenciado, com código de verificação.', 39000, 'UNIT'),
  ('APPRAISAL_FORENSIC', 'Laudo pericial', 'Sob orçamento.', 0, 'QUOTE'),
  ('PROVENANCE_CHECK', 'Checagem de proveniência', 'Consulta a bases de obras roubadas e histórico.', 29000, 'UNIT'),
  ('SHIPPING', 'Frete especializado', 'Cotado por transportadora de arte.', 0, 'QUOTE'),
  ('TRANSIT_INSURANCE', 'Seguro de trânsito', 'Cotado por seguradora.', 0, 'QUOTE'),
  ('COLLECTION_INSURANCE', 'Seguro de acervo', 'Apólice anual da obra na carteira.', 0, 'QUOTE'),
  ('EXPORT_ASSIST', 'Assessoria de exportação', 'Documentação IPHAN e despacho.', 89000, 'UNIT'),
  ('MARKETPLACE_FEATURE', 'Destaque no marketplace', 'Uma semana em destaque.', 9900, 'WEEK'),
  ('PLAN_SUBSCRIPTION', 'Assinatura de plano', 'Mensalidade do plano.', 0, 'UNIT'),
  ('PARTNER_SERVICE', 'Serviço de parceiro', 'Molduraria, restauro e afins (10 % de intermediação).', 0, 'QUOTE')
ON CONFLICT ("code") DO NOTHING;
