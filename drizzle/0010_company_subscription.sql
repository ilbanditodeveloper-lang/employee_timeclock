-- Fase 6A: planes manuales y trial comercial
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "subscriptionPlan" varchar(32) DEFAULT 'trial' NOT NULL;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "trialEndsAt" timestamp;

-- Empresas existentes antes de billing: legacy sin trial
UPDATE "companies"
SET "subscriptionPlan" = 'legacy',
    "trialEndsAt" = NULL
WHERE "subscriptionPlan" = 'trial'
  AND "trialEndsAt" IS NULL
  AND "createdAt" < NOW() - INTERVAL '1 minute';
