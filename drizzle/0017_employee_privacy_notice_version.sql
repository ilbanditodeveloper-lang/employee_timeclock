-- Version del aviso de privacidad por empresa (reaceptación al cambiar datos legales).
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "employeePrivacyNoticeVersion" varchar(32);
UPDATE "companies"
SET "employeePrivacyNoticeVersion" = '2026-06-22-v2'
WHERE "employeePrivacyNoticeVersion" IS NULL;
ALTER TABLE "companies" ALTER COLUMN "employeePrivacyNoticeVersion" SET DEFAULT '2026-06-22-v2';
ALTER TABLE "companies" ALTER COLUMN "employeePrivacyNoticeVersion" SET NOT NULL;
