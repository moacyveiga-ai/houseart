-- Rodadas de cron/job e falhas de webhook (Admin › Saúde operacional).
CREATE TABLE IF NOT EXISTS "JobRun" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "runId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ms" INTEGER,
    "httpStatus" INTEGER,
    "error" TEXT,
    "summary" TEXT,
    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "JobRun_kind_name_startedAt_idx" ON "JobRun"("kind", "name", "startedAt");
CREATE INDEX IF NOT EXISTS "JobRun_status_startedAt_idx" ON "JobRun"("status", "startedAt");
