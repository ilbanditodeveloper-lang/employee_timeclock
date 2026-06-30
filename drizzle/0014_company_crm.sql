ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "crmStage" varchar(32) DEFAULT 'trial' NOT NULL;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "crmContactName" varchar(255);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "crmContactPhone" varchar(32);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "crmNotes" text;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "crmNextFollowUpAt" timestamp;

CREATE TABLE IF NOT EXISTS "company_crm_activities" (
  "id" serial PRIMARY KEY NOT NULL,
  "companyId" integer NOT NULL,
  "activityType" varchar(32) DEFAULT 'note' NOT NULL,
  "body" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "company_crm_activities_company_idx" ON "company_crm_activities" ("companyId");

UPDATE "companies"
SET "crmStage" = CASE
  WHEN "isActive" = false THEN 'churned'
  WHEN "subscriptionPlan" = 'trial' THEN 'trial'
  WHEN "billingStatus" IN ('active', 'trialing') THEN 'paying'
  ELSE 'active'
END
WHERE "crmStage" = 'trial';
