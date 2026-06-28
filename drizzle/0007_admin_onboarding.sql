ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "onboardingCompleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" timestamp;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "onboardingSkippedAt" timestamp;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "onboardingLegalAcknowledgedAt" timestamp;--> statement-breakpoint
UPDATE "companies" SET "onboardingCompleted" = true WHERE "onboardingCompleted" = false;
