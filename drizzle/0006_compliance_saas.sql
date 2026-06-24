-- Compliance & SaaS hardening migration
DO $$ BEGIN
  CREATE TYPE "public"."timeclock_status" AS ENUM('valid', 'corrected', 'voided');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."clock_source" AS ENUM('mobile', 'admin_panel', 'tablet', 'qr');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."audit_entity_type" AS ENUM('timeclock', 'employee', 'company', 'incident');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."legal_document_type" AS ENUM('employee_privacy_notice', 'platform_terms');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "legalName" varchar(255);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "taxId" varchar(32);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "privacyContactEmail" varchar(320);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "country" varchar(2) DEFAULT 'ES' NOT NULL;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "timezone" varchar(64) DEFAULT 'Europe/Madrid' NOT NULL;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "locationEnabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "dataRetentionYears" integer DEFAULT 4 NOT NULL;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" timestamp;

ALTER TABLE "timeclocks" ADD COLUMN IF NOT EXISTS "status" "timeclock_status" DEFAULT 'valid' NOT NULL;
ALTER TABLE "timeclocks" ADD COLUMN IF NOT EXISTS "source" "clock_source" DEFAULT 'mobile' NOT NULL;
ALTER TABLE "timeclocks" ADD COLUMN IF NOT EXISTS "exitLatitude" numeric(10, 8);
ALTER TABLE "timeclocks" ADD COLUMN IF NOT EXISTS "exitLongitude" numeric(11, 8);
ALTER TABLE "timeclocks" ADD COLUMN IF NOT EXISTS "correctionReason" text;
ALTER TABLE "timeclocks" ADD COLUMN IF NOT EXISTS "correctedByUserId" integer;
ALTER TABLE "timeclocks" ADD COLUMN IF NOT EXISTS "correctedAt" timestamp;
ALTER TABLE "timeclocks" ADD COLUMN IF NOT EXISTS "voidReason" text;
ALTER TABLE "timeclocks" ADD COLUMN IF NOT EXISTS "voidedByUserId" integer;
ALTER TABLE "timeclocks" ADD COLUMN IF NOT EXISTS "voidedAt" timestamp;

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "companyId" integer NOT NULL,
  "entityType" "audit_entity_type" NOT NULL,
  "entityId" integer NOT NULL,
  "action" varchar(64) NOT NULL,
  "oldValue" jsonb,
  "newValue" jsonb,
  "reason" text,
  "performedByType" varchar(32) NOT NULL,
  "performedById" integer,
  "performedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "legal_acceptances" (
  "id" serial PRIMARY KEY NOT NULL,
  "companyId" integer NOT NULL,
  "employeeId" integer NOT NULL,
  "documentType" "legal_document_type" NOT NULL,
  "documentVersion" varchar(32) NOT NULL,
  "acceptedAt" timestamp DEFAULT now() NOT NULL,
  "ipAddress" varchar(64)
);

CREATE INDEX IF NOT EXISTS "timeclocks_company_employee_entry_idx" ON "timeclocks" ("companyId", "employeeId", "entryTime");
CREATE INDEX IF NOT EXISTS "timeclocks_company_idx" ON "timeclocks" ("companyId");
CREATE INDEX IF NOT EXISTS "employees_company_idx" ON "employees" ("companyId");
CREATE INDEX IF NOT EXISTS "audit_logs_company_entity_idx" ON "audit_logs" ("companyId", "entityType", "entityId");

ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_username_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "employees_company_username_idx" ON "employees" ("companyId", "username");
CREATE UNIQUE INDEX IF NOT EXISTS "legal_acceptances_employee_doc_idx" ON "legal_acceptances" ("employeeId", "documentType", "documentVersion");
