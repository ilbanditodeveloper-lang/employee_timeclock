-- Email de acceso para empleados (login sin slug)
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "email" varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS "employees_company_email_lower_unique_idx"
  ON "employees" ("companyId", lower(trim("email")))
  WHERE "email" IS NOT NULL AND trim("email") <> '';
