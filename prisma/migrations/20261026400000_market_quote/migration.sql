-- Header ticker: dollar, euro and the HouseArt index (lib/market-indicators). Additive, reexecutable.
CREATE TABLE IF NOT EXISTS "MarketQuote" (
    "key" TEXT NOT NULL,
    "valueMicros" BIGINT,
    "changeBps" INTEGER,
    "observedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketQuote_pkey" PRIMARY KEY ("key")
);
