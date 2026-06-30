ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "stripeCustomerId" varchar(255);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" varchar(255);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "billingStatus" varchar(32);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "billingEmail" varchar(320);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" timestamp;

ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "isPrimary" boolean DEFAULT false NOT NULL;

-- Marcar como principal el primer local de cada empresa (por id mínimo)
UPDATE "restaurants" r
SET "isPrimary" = true
FROM (
  SELECT "companyId", MIN(id) AS id
  FROM "restaurants"
  GROUP BY "companyId"
) first_loc
WHERE r.id = first_loc.id;
