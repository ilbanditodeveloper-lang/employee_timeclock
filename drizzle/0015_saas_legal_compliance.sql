-- SaaS legal/compliance: tiempo parcial, RGPD, DPA, GPS, retención, RBAC, informes mensuales
-- IMPORTANTE: columnas en camelCase quoted, coherente con drizzle/schema.ts y migraciones anteriores.

DO $$ BEGIN
  CREATE TYPE "contract_type" AS ENUM ('full_time', 'part_time', 'temporary', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "admin_role" AS ENUM ('owner', 'admin', 'hr_manager', 'accountant', 'read_only_auditor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "gdpr_request_type" AS ENUM ('access', 'rectification', 'erasure', 'restriction', 'objection', 'portability', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "gdpr_request_status" AS ENUM ('received', 'in_review', 'resolved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "legal_document_code" AS ENUM ('privacy_policy', 'terms_of_use', 'dpa', 'employee_notice');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "monthly_report_delivery_type" AS ENUM ('admin_generated', 'employee_downloaded', 'admin_delivered');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "contractType" "contract_type" DEFAULT 'full_time' NOT NULL;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "weeklyContractedHours" numeric(5, 2);
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "nationalId" varchar(32);

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "province" varchar(100);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "legalContactName" varchar(255);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "gpsJustification" text;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "gpsJustificationCategory" varchar(64);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "gpsActivatedBy" integer;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "gpsActivatedAt" timestamp;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "legalHoldEnabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "minimumRetentionYears" integer DEFAULT 4 NOT NULL;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "anonymizeAfterRetention" boolean DEFAULT false NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "adminRole" "admin_role" DEFAULT 'admin';

CREATE TABLE IF NOT EXISTS "legal_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" "legal_document_code" NOT NULL,
  "version" varchar(32) NOT NULL,
  "title" varchar(255) NOT NULL,
  "body" text NOT NULL,
  "publishedAt" timestamp DEFAULT now() NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "documentHash" varchar(64),
  UNIQUE ("code", "version")
);

CREATE TABLE IF NOT EXISTS "company_legal_acceptances" (
  "id" serial PRIMARY KEY NOT NULL,
  "companyId" integer NOT NULL,
  "acceptedByUserId" integer NOT NULL,
  "documentCode" "legal_document_code" NOT NULL,
  "documentVersion" varchar(32) NOT NULL,
  "documentHash" varchar(64),
  "acceptedAt" timestamp DEFAULT now() NOT NULL,
  "ipAddress" varchar(64),
  "userAgent" text
);

CREATE INDEX IF NOT EXISTS "company_legal_acceptances_company_idx" ON "company_legal_acceptances" ("companyId");

CREATE TABLE IF NOT EXISTS "gdpr_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "companyId" integer NOT NULL,
  "employeeId" integer NOT NULL,
  "requestType" "gdpr_request_type" NOT NULL,
  "message" text NOT NULL,
  "status" "gdpr_request_status" DEFAULT 'received' NOT NULL,
  "adminNotes" text,
  "resolvedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "gdpr_requests_company_status_idx" ON "gdpr_requests" ("companyId", "status");

CREATE TABLE IF NOT EXISTS "monthly_report_deliveries" (
  "id" serial PRIMARY KEY NOT NULL,
  "companyId" integer NOT NULL,
  "employeeId" integer NOT NULL,
  "periodYear" integer NOT NULL,
  "periodMonth" integer NOT NULL,
  "reportType" varchar(64) DEFAULT 'monthly_summary' NOT NULL,
  "deliveryType" "monthly_report_delivery_type" NOT NULL,
  "documentHash" varchar(64),
  "ipAddress" varchar(64),
  "userAgent" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "monthly_report_deliveries_emp_period_idx"
  ON "monthly_report_deliveries" ("employeeId", "periodYear", "periodMonth");

ALTER TABLE "legal_acceptances" ADD COLUMN IF NOT EXISTS "userAgent" text;
ALTER TABLE "legal_acceptances" ADD COLUMN IF NOT EXISTS "documentHash" varchar(64);

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "ipAddress" varchar(64);
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "userAgent" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "previousHash" varchar(64);
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "currentHash" varchar(64);

CREATE OR REPLACE FUNCTION prevent_critical_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'DELETE no permitido en %: conservación legal y trazabilidad', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS timeclocks_no_delete ON "timeclocks";
CREATE TRIGGER timeclocks_no_delete BEFORE DELETE ON "timeclocks"
  FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();

DROP TRIGGER IF EXISTS timeclock_breaks_no_delete ON "timeclock_breaks";
CREATE TRIGGER timeclock_breaks_no_delete BEFORE DELETE ON "timeclock_breaks"
  FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON "audit_logs";
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();

DROP TRIGGER IF EXISTS legal_acceptances_no_delete ON "legal_acceptances";
CREATE TRIGGER legal_acceptances_no_delete BEFORE DELETE ON "legal_acceptances"
  FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
