-- SaaS legal/compliance: tiempo parcial, RGPD, DPA, GPS, retención, RBAC, informes mensuales

DO $$ BEGIN
  CREATE TYPE contract_type AS ENUM ('full_time', 'part_time', 'temporary', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM ('owner', 'admin', 'hr_manager', 'accountant', 'read_only_auditor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gdpr_request_type AS ENUM ('access', 'rectification', 'erasure', 'restriction', 'objection', 'portability', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gdpr_request_status AS ENUM ('received', 'in_review', 'resolved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE legal_document_code AS ENUM ('privacy_policy', 'terms_of_use', 'dpa', 'employee_notice');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE monthly_report_delivery_type AS ENUM ('admin_generated', 'employee_downloaded', 'admin_delivered');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type contract_type DEFAULT 'full_time' NOT NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS weekly_contracted_hours numeric(5, 2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS national_id varchar(32);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS province varchar(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS legal_contact_name varchar(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS gps_justification text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS gps_justification_category varchar(64);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS gps_activated_by integer;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS gps_activated_at timestamp;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS legal_hold_enabled boolean DEFAULT false NOT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS minimum_retention_years integer DEFAULT 4 NOT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS anonymize_after_retention boolean DEFAULT false NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role admin_role DEFAULT 'admin';

CREATE TABLE IF NOT EXISTS legal_documents (
  id serial PRIMARY KEY,
  code legal_document_code NOT NULL,
  version varchar(32) NOT NULL,
  title varchar(255) NOT NULL,
  body text NOT NULL,
  published_at timestamp DEFAULT now() NOT NULL,
  active boolean DEFAULT true NOT NULL,
  document_hash varchar(64),
  UNIQUE (code, version)
);

CREATE TABLE IF NOT EXISTS company_legal_acceptances (
  id serial PRIMARY KEY,
  "companyId" integer NOT NULL,
  "acceptedByUserId" integer NOT NULL,
  document_code legal_document_code NOT NULL,
  document_version varchar(32) NOT NULL,
  document_hash varchar(64),
  accepted_at timestamp DEFAULT now() NOT NULL,
  ip_address varchar(64),
  user_agent text
);

CREATE INDEX IF NOT EXISTS company_legal_acceptances_company_idx ON company_legal_acceptances ("companyId");

CREATE TABLE IF NOT EXISTS gdpr_requests (
  id serial PRIMARY KEY,
  "companyId" integer NOT NULL,
  "employeeId" integer NOT NULL,
  request_type gdpr_request_type NOT NULL,
  message text NOT NULL,
  status gdpr_request_status DEFAULT 'received' NOT NULL,
  admin_notes text,
  resolved_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS gdpr_requests_company_status_idx ON gdpr_requests ("companyId", status);

CREATE TABLE IF NOT EXISTS monthly_report_deliveries (
  id serial PRIMARY KEY,
  "companyId" integer NOT NULL,
  "employeeId" integer NOT NULL,
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  report_type varchar(64) DEFAULT 'monthly_summary' NOT NULL,
  delivery_type monthly_report_delivery_type NOT NULL,
  document_hash varchar(64),
  ip_address varchar(64),
  user_agent text,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS monthly_report_deliveries_emp_period_idx
  ON monthly_report_deliveries ("employeeId", period_year, period_month);

ALTER TABLE legal_acceptances ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE legal_acceptances ADD COLUMN IF NOT EXISTS document_hash varchar(64);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address varchar(64);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_hash varchar(64);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS current_hash varchar(64);

-- Protección práctica: impedir DELETE en tablas críticas (solo superuser puede borrar)
CREATE OR REPLACE FUNCTION prevent_critical_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'DELETE no permitido en %: conservación legal y trazabilidad', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS timeclocks_no_delete ON timeclocks;
CREATE TRIGGER timeclocks_no_delete BEFORE DELETE ON timeclocks
  FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();

DROP TRIGGER IF EXISTS timeclock_breaks_no_delete ON timeclock_breaks;
CREATE TRIGGER timeclock_breaks_no_delete BEFORE DELETE ON timeclock_breaks
  FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();

DROP TRIGGER IF EXISTS legal_acceptances_no_delete ON legal_acceptances;
CREATE TRIGGER legal_acceptances_no_delete BEFORE DELETE ON legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete();
