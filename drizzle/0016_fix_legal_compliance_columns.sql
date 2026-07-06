-- Repara BD que ejecutaron 0015 con nombres snake_case incorrectos.
-- Copia datos a columnas camelCase (drizzle) y elimina columnas erróneas.

-- employees
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "contractType" "contract_type" DEFAULT 'full_time';
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "weeklyContractedHours" numeric(5, 2);
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "nationalId" varchar(32);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'contract_type'
  ) THEN
    UPDATE "employees" SET "contractType" = contract_type::text::"contract_type"
    WHERE "contractType" IS NULL;
    ALTER TABLE "employees" DROP COLUMN contract_type;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'weekly_contracted_hours'
  ) THEN
    UPDATE "employees" SET "weeklyContractedHours" = weekly_contracted_hours
    WHERE "weeklyContractedHours" IS NULL;
    ALTER TABLE "employees" DROP COLUMN weekly_contracted_hours;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'national_id'
  ) THEN
    UPDATE "employees" SET "nationalId" = national_id WHERE "nationalId" IS NULL;
    ALTER TABLE "employees" DROP COLUMN national_id;
  END IF;
END $$;

ALTER TABLE "employees" ALTER COLUMN "contractType" SET DEFAULT 'full_time';
UPDATE "employees" SET "contractType" = 'full_time' WHERE "contractType" IS NULL;
ALTER TABLE "employees" ALTER COLUMN "contractType" SET NOT NULL;

-- companies
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "province" varchar(100);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "legalContactName" varchar(255);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "gpsJustification" text;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "gpsJustificationCategory" varchar(64);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "gpsActivatedBy" integer;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "gpsActivatedAt" timestamp;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "legalHoldEnabled" boolean DEFAULT false;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "minimumRetentionYears" integer DEFAULT 4;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "anonymizeAfterRetention" boolean DEFAULT false;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'legal_contact_name') THEN
    UPDATE "companies" SET "legalContactName" = legal_contact_name WHERE "legalContactName" IS NULL;
    ALTER TABLE "companies" DROP COLUMN legal_contact_name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'gps_justification') THEN
    UPDATE "companies" SET "gpsJustification" = gps_justification WHERE "gpsJustification" IS NULL;
    ALTER TABLE "companies" DROP COLUMN gps_justification;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'gps_justification_category') THEN
    UPDATE "companies" SET "gpsJustificationCategory" = gps_justification_category WHERE "gpsJustificationCategory" IS NULL;
    ALTER TABLE "companies" DROP COLUMN gps_justification_category;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'gps_activated_by') THEN
    UPDATE "companies" SET "gpsActivatedBy" = gps_activated_by WHERE "gpsActivatedBy" IS NULL;
    ALTER TABLE "companies" DROP COLUMN gps_activated_by;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'gps_activated_at') THEN
    UPDATE "companies" SET "gpsActivatedAt" = gps_activated_at WHERE "gpsActivatedAt" IS NULL;
    ALTER TABLE "companies" DROP COLUMN gps_activated_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'legal_hold_enabled') THEN
    UPDATE "companies" SET "legalHoldEnabled" = legal_hold_enabled WHERE "legalHoldEnabled" IS NULL;
    ALTER TABLE "companies" DROP COLUMN legal_hold_enabled;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'minimum_retention_years') THEN
    UPDATE "companies" SET "minimumRetentionYears" = minimum_retention_years WHERE "minimumRetentionYears" IS NULL;
    ALTER TABLE "companies" DROP COLUMN minimum_retention_years;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'anonymize_after_retention') THEN
    UPDATE "companies" SET "anonymizeAfterRetention" = anonymize_after_retention WHERE "anonymizeAfterRetention" IS NULL;
    ALTER TABLE "companies" DROP COLUMN anonymize_after_retention;
  END IF;
END $$;

UPDATE "companies" SET "legalHoldEnabled" = false WHERE "legalHoldEnabled" IS NULL;
UPDATE "companies" SET "minimumRetentionYears" = 4 WHERE "minimumRetentionYears" IS NULL;
UPDATE "companies" SET "anonymizeAfterRetention" = false WHERE "anonymizeAfterRetention" IS NULL;
ALTER TABLE "companies" ALTER COLUMN "legalHoldEnabled" SET NOT NULL;
ALTER TABLE "companies" ALTER COLUMN "minimumRetentionYears" SET NOT NULL;
ALTER TABLE "companies" ALTER COLUMN "anonymizeAfterRetention" SET NOT NULL;

-- users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "adminRole" "admin_role" DEFAULT 'admin';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'admin_role') THEN
    UPDATE "users" SET "adminRole" = admin_role::text::"admin_role" WHERE "adminRole" IS NULL;
    ALTER TABLE "users" DROP COLUMN admin_role;
  END IF;
END $$;

-- audit_logs / legal_acceptances extras
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "ipAddress" varchar(64);
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "userAgent" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "previousHash" varchar(64);
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "currentHash" varchar(64);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'ip_address') THEN
    UPDATE "audit_logs" SET "ipAddress" = ip_address WHERE "ipAddress" IS NULL;
    ALTER TABLE "audit_logs" DROP COLUMN ip_address;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'user_agent') THEN
    UPDATE "audit_logs" SET "userAgent" = user_agent WHERE "userAgent" IS NULL;
    ALTER TABLE "audit_logs" DROP COLUMN user_agent;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'previous_hash') THEN
    UPDATE "audit_logs" SET "previousHash" = previous_hash WHERE "previousHash" IS NULL;
    ALTER TABLE "audit_logs" DROP COLUMN previous_hash;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'current_hash') THEN
    UPDATE "audit_logs" SET "currentHash" = current_hash WHERE "currentHash" IS NULL;
    ALTER TABLE "audit_logs" DROP COLUMN current_hash;
  END IF;
END $$;

ALTER TABLE "legal_acceptances" ADD COLUMN IF NOT EXISTS "userAgent" text;
ALTER TABLE "legal_acceptances" ADD COLUMN IF NOT EXISTS "documentHash" varchar(64);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'legal_acceptances' AND column_name = 'user_agent') THEN
    UPDATE "legal_acceptances" SET "userAgent" = user_agent WHERE "userAgent" IS NULL;
    ALTER TABLE "legal_acceptances" DROP COLUMN user_agent;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'legal_acceptances' AND column_name = 'document_hash') THEN
    UPDATE "legal_acceptances" SET "documentHash" = document_hash WHERE "documentHash" IS NULL;
    ALTER TABLE "legal_acceptances" DROP COLUMN document_hash;
  END IF;
END $$;

-- Tablas nuevas creadas con snake_case: recrear con camelCase si hace falta
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gdpr_requests' AND column_name = 'request_type'
  ) THEN
    DROP TABLE IF EXISTS "gdpr_requests";
  END IF;
END $$;

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

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monthly_report_deliveries' AND column_name = 'period_year'
  ) THEN
    DROP TABLE IF EXISTS "monthly_report_deliveries";
  END IF;
END $$;

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

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_legal_acceptances' AND column_name = 'document_code'
  ) THEN
    DROP TABLE IF EXISTS "company_legal_acceptances";
  END IF;
END $$;

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

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'legal_documents' AND column_name = 'published_at'
  ) THEN
    DROP TABLE IF EXISTS "legal_documents";
  END IF;
END $$;

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
