-- Instagram: the person's own professional account and the community posts sent to it.
CREATE TABLE IF NOT EXISTS "InstagramConnection" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "igUserId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "accountType" TEXT,
    "followers" INTEGER,
    "tokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "defaultOn" BOOLEAN NOT NULL DEFAULT false,
    "includeLink" BOOLEAN NOT NULL DEFAULT true,
    "tagArtist" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstagramConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramConnection_userId_key" ON "InstagramConnection"("userId");
CREATE INDEX IF NOT EXISTS "InstagramConnection_tokenExpiresAt_idx" ON "InstagramConnection"("tokenExpiresAt");

CREATE TABLE IF NOT EXISTS "InstagramPublication" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "feedMediaId" TEXT,
    "storyMediaId" TEXT,
    "feedContainerId" TEXT,
    "storyContainerId" TEXT,
    "code" TEXT NOT NULL,
    "targetPath" TEXT NOT NULL,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "insightsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstagramPublication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramPublication_postId_key" ON "InstagramPublication"("postId");
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramPublication_code_key" ON "InstagramPublication"("code");
CREATE INDEX IF NOT EXISTS "InstagramPublication_userId_createdAt_idx" ON "InstagramPublication"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "InstagramPublication_status_idx" ON "InstagramPublication"("status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstagramConnection_mode_check') THEN
    ALTER TABLE "InstagramConnection" ADD CONSTRAINT "InstagramConnection_mode_check" CHECK ("mode" IN ('MOCK', 'LIVE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstagramPublication_format_check') THEN
    ALTER TABLE "InstagramPublication" ADD CONSTRAINT "InstagramPublication_format_check" CHECK ("format" IN ('FEED', 'STORIES', 'BOTH'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstagramPublication_status_check') THEN
    ALTER TABLE "InstagramPublication" ADD CONSTRAINT "InstagramPublication_status_check" CHECK ("status" IN ('PENDING', 'PUBLISHED', 'FAILED'));
  END IF;
END $$;
