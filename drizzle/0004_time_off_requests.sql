DO $$ BEGIN
  CREATE TYPE "public"."time_off_kind" AS ENUM('vacation', 'day_off');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."time_off_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "time_off_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employeeId" integer NOT NULL,
	"kind" "time_off_kind" NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date NOT NULL,
	"comment" text NOT NULL,
	"status" "time_off_status" DEFAULT 'pending' NOT NULL,
	"reviewedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
