-- Endereços de entrega of a person (Perfil › minha conta); the default pre-fills the checkout.
CREATE TABLE IF NOT EXISTS "ShippingAddress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShippingAddress_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ShippingAddress_userId_idx" ON "ShippingAddress"("userId");
-- one default address per person
CREATE UNIQUE INDEX IF NOT EXISTS "ShippingAddress_user_default_key" ON "ShippingAddress"("userId") WHERE "isDefault";
