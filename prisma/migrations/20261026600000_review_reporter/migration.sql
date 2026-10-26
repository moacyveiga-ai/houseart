-- Denúncia em conversa: who reported, so each side of a conversation keeps its own report.
ALTER TABLE "ReviewQueueItem" ADD COLUMN IF NOT EXISTS "reporterUserId" INTEGER;
