-- Saúde operacional: who ran a cron by hand ("Rodar agora"); null for the scheduled run.
ALTER TABLE "JobRun" ADD COLUMN IF NOT EXISTS "triggeredById" INTEGER;
